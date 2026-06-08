import {
  cleanHlsPlaylist,
  decodeHlsCleanParam,
  validateCleanHlsReferer,
  validateCleanHlsUrl,
  validateContentPathPrefix,
} from "@/lib/hls-cleaner";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceUrl = validateCleanHlsUrl(decodeHlsCleanParam(searchParams.get("u"), "u"));
    const referer = validateCleanHlsReferer(decodeHlsCleanParam(searchParams.get("r"), "r"));
    const contentPathPrefix = validateContentPathPrefix(decodeHlsCleanParam(searchParams.get("p"), "p"));

    const upstream = await fetch(sourceUrl, {
      headers: {
        Accept: "application/vnd.apple.mpegurl,*/*",
        Referer: referer.toString(),
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!upstream.ok) {
      return new Response("Failed to fetch HLS playlist.", { status: 502 });
    }

    const result = cleanHlsPlaylist({
      sourceUrl,
      playlist: await upstream.text(),
      contentPathPrefix,
    });
    if (result.removedSegments === 0) {
      return new Response("HLS playlist did not contain removable ad segments.", { status: 422 });
    }

    return new Response(result.playlist, {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid HLS clean request.";
    return new Response(message, { status: 400 });
  }
}
