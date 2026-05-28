import assert from "node:assert/strict";
import test from "node:test";

import { formatTarget, parseTarget, parseTargets } from "@/lib/targets";

test("parseTarget understands user targets", () => {
  assert.deepEqual(parseTarget("OpenAI"), {
    kind: "user",
    value: "OpenAI",
    normalizedValue: "openai",
    tags: [],
  });
});

test("parseTarget understands keyword targets", () => {
  assert.deepEqual(parseTarget("search:AI Safety"), {
    kind: "keyword",
    value: "AI Safety",
    normalizedValue: "ai safety",
    tags: [],
  });
});

test("parseTargets deduplicates normalized values", () => {
  const targets = parseTargets(["OpenAI", "openai", "search:AI", "search:ai"]);
  assert.equal(targets.length, 2);
  assert.equal(formatTarget(targets[0]), "OpenAI");
  assert.equal(formatTarget(targets[1]), "search:AI");
});

test("parseTargets accepts object targets with category and free tags", () => {
  const targets = parseTargets([
    {
      target: "search:AI coding",
      category: "tech",
      tags: ["AI", " 编程 ", "ai", "", "Claude Code"],
    },
  ]);

  assert.deepEqual(targets, [
    {
      kind: "keyword",
      value: "AI coding",
      normalizedValue: "ai coding",
      category: "tech",
      tags: ["AI", "编程", "Claude Code"],
    },
  ]);
});

test("parseTargets rejects invalid target metadata", () => {
  assert.throws(
    () =>
      parseTargets([
        {
          target: "search:AI",
          tags: ["AI"],
        },
      ]),
    /Target category is required/,
  );

  assert.throws(
    () =>
      parseTargets([
        {
          target: "search:AI",
          category: 1,
        },
      ]),
    /Target category must be a string/,
  );

  assert.throws(
    () =>
      parseTargets([
        {
          target: "search:AI",
          category: "tech",
          tags: "AI",
        },
      ]),
    /Target tags must be an array/,
  );
});
