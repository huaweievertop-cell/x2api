import assert from "node:assert/strict";
import test from "node:test";

import { buildAuthorPresentation, resolveAuthorPresentation } from "@/lib/author-presentation";

test("buildAuthorPresentation returns X profile only for twitter sources", () => {
  assert.deepEqual(
    buildAuthorPresentation({
      source: "twitter",
      target: "search:AI",
      author: "@openai",
      fullname: "OpenAI",
      xUrl: "https://x.com/openai/status/1",
    }),
    {
      displayAuthor: "OpenAI",
      displayHandle: "@openai",
      authorProfileUrl: "https://x.com/openai",
      authorProfilePlatform: "X",
    },
  );
});

test("buildAuthorPresentation uses item detail links for site sources", () => {
  const cases = [
    ["heiliao", "黑料", "https://among.uvsoskqus.cc/archives/1"],
    ["cg91", "91吃瓜", "https://www.91cg1.com/post/1"],
    ["baoliao51", "51爆料", "https://www.51baoliao01.com/archives/1"],
    ["douyin", "抖阴", "https://xygrfrfb3g.b2h7y8w.com/v/1"],
  ] as const;

  for (const [source, platform, link] of cases) {
    assert.deepEqual(
      buildAuthorPresentation({
        source,
        target: `${source}:https://example.com`,
        author: `${platform}网`,
        fullname: `${platform}网`,
        link,
      }),
      {
        displayAuthor: `${platform}网`,
        displayHandle: null,
        authorProfileUrl: link,
        authorProfilePlatform: platform,
      },
    );
  }
});

test("buildAuthorPresentation does not use site target homepages as item links", () => {
  assert.deepEqual(
    buildAuthorPresentation({
      source: "91",
      target: "cg91:https://www.91cg1.com",
      author: "91吃瓜网",
      fullname: "91吃瓜网",
    }),
    {
      displayAuthor: "91吃瓜网",
      displayHandle: null,
      authorProfileUrl: null,
      authorProfilePlatform: null,
    },
  );
});

test("buildAuthorPresentation returns YouTube profile for YouTube sources", () => {
  assert.deepEqual(
    buildAuthorPresentation({
      source: "youtube",
      target: "youtube:https://www.youtube.com/feeds/videos.xml?channel_id=UC12345678901234567890",
      author: "Channel",
      fullname: "Channel",
      link: "https://www.youtube.com/watch?v=abc123",
    }),
    {
      displayAuthor: "Channel",
      displayHandle: null,
      authorProfileUrl: "https://www.youtube.com/channel/UC12345678901234567890",
      authorProfilePlatform: "YouTube",
    },
  );
});

test("buildAuthorPresentation normalizes source aliases before presentation", () => {
  assert.deepEqual(
    buildAuthorPresentation({
      source: "x",
      target: "search:AI",
      author: "@openai",
      fullname: "OpenAI",
    }),
    {
      displayAuthor: "OpenAI",
      displayHandle: "@openai",
      authorProfileUrl: "https://x.com/openai",
      authorProfilePlatform: "X",
    },
  );

  assert.deepEqual(
    buildAuthorPresentation({
      source: "yt",
      target: "youtube:UC12345678901234567890",
      author: "Channel",
      fullname: "Channel",
    }),
    {
      displayAuthor: "Channel",
      displayHandle: null,
      authorProfileUrl: "https://www.youtube.com/channel/UC12345678901234567890",
      authorProfilePlatform: "YouTube",
    },
  );
});

test("resolveAuthorPresentation prefers stored presentation fields", () => {
  assert.deepEqual(
    resolveAuthorPresentation({
      source: "twitter",
      target: "search:AI",
      author: "@openai",
      fullname: "OpenAI",
      displayAuthor: "Stored Author",
      displayHandle: "@stored",
      authorProfileUrl: "https://x.com/stored",
      authorProfilePlatform: "Stored",
    }),
    {
      displayAuthor: "Stored Author",
      displayHandle: "@stored",
      authorProfileUrl: "https://x.com/stored",
      authorProfilePlatform: "Stored",
    },
  );
});
