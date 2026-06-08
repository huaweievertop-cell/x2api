const HLS_CLEAN_ALLOWED_SOURCE_HOSTS = [/^(?:m3u8|video)\.cdn\d+\.com$/];
const HLS_CLEAN_ALLOWED_REFERER_HOSTS = new Set(["18j.tv", "www.18j.tv"]);

export type CleanHlsResult = {
  playlist: string;
  keptSegments: number;
  removedSegments: number;
};

function isAllowedSourceHost(host: string) {
  return HLS_CLEAN_ALLOWED_SOURCE_HOSTS.some((pattern) => pattern.test(host.toLowerCase()));
}

export function encodeHlsCleanParam(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function decodeHlsCleanParam(value: string | null, name: string) {
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    throw new Error(`Invalid ${name}.`);
  }
}

export function validateCleanHlsUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid HLS URL.");
  }
  if (url.protocol !== "https:" || !isAllowedSourceHost(url.hostname) || !url.pathname.endsWith(".m3u8")) {
    throw new Error("Unsupported HLS URL.");
  }
  return url;
}

export function validateCleanHlsReferer(rawReferer: string) {
  let referer: URL;
  try {
    referer = new URL(rawReferer);
  } catch {
    throw new Error("Invalid HLS referer.");
  }
  if (referer.protocol !== "https:" || !HLS_CLEAN_ALLOWED_REFERER_HOSTS.has(referer.hostname.toLowerCase())) {
    throw new Error("Unsupported HLS referer.");
  }
  return referer;
}

export function validateContentPathPrefix(rawPrefix: string) {
  if (!/^\/videos\/\d{6}\/\d{2}\/[A-Za-z0-9]+\/$/.test(rawPrefix)) {
    throw new Error("Unsupported HLS content prefix.");
  }
  return rawPrefix;
}

function rewriteKeyLine(line: string, sourceUrl: URL, contentPathPrefix: string) {
  const match = line.match(/\bURI="([^"]+)"/);
  if (!match) {
    return line;
  }
  const keyUrl = new URL(match[1]!, sourceUrl);
  if (!isAllowedSourceHost(keyUrl.hostname) || !keyUrl.pathname.startsWith(contentPathPrefix)) {
    return null;
  }
  return line.replace(match[1]!, keyUrl.toString());
}

export function cleanHlsPlaylist(input: {
  sourceUrl: string | URL;
  playlist: string;
  contentPathPrefix: string;
}): CleanHlsResult {
  const sourceUrl = typeof input.sourceUrl === "string" ? validateCleanHlsUrl(input.sourceUrl) : input.sourceUrl;
  const contentPathPrefix = validateContentPathPrefix(input.contentPathPrefix);
  const output: string[] = [];
  let pending: string[] = [];
  let keptSegments = 0;
  let removedSegments = 0;
  let seenSegmentTags = false;

  for (const rawLine of input.playlist.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line === "#EXT-X-ENDLIST") {
      continue;
    }
    if (line.startsWith("#EXTINF:")) {
      pending.push(line);
      seenSegmentTags = true;
      continue;
    }
    if (line.startsWith("#")) {
      if (line === "#EXT-X-DISCONTINUITY") {
        continue;
      }
      let nextLine: string | null = line;
      if (line.startsWith("#EXT-X-KEY")) {
        nextLine = rewriteKeyLine(line, sourceUrl, contentPathPrefix);
        if (!nextLine) {
          continue;
        }
      }
      if (seenSegmentTags) {
        pending.push(nextLine);
      } else {
        output.push(nextLine);
      }
      continue;
    }

    const segmentUrl = new URL(line, sourceUrl);
    if (isAllowedSourceHost(segmentUrl.hostname) && segmentUrl.pathname.startsWith(contentPathPrefix)) {
      for (const pendingLine of pending) {
        if (pendingLine.startsWith("#EXT-X-KEY")) {
          const rewritten = rewriteKeyLine(pendingLine, sourceUrl, contentPathPrefix);
          if (rewritten) {
            output.push(rewritten);
          }
        } else {
          output.push(pendingLine);
        }
      }
      output.push(segmentUrl.toString());
      keptSegments += 1;
    } else {
      removedSegments += 1;
    }
    pending = [];
  }

  if (keptSegments === 0) {
    throw new Error("Cleaned HLS playlist has no playable segments.");
  }
  output.push("#EXT-X-ENDLIST");
  return {
    playlist: `${output.join("\n")}\n`,
    keptSegments,
    removedSegments,
  };
}

export function buildCleanHlsPath(input: { sourceUrl: string; referer: string; contentPathPrefix: string }) {
  return `/api/hls/clean?u=${encodeHlsCleanParam(input.sourceUrl)}&r=${encodeHlsCleanParam(input.referer)}&p=${encodeHlsCleanParam(input.contentPathPrefix)}`;
}
