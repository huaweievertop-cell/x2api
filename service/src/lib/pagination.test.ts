import assert from "node:assert/strict";
import test from "node:test";

import {
  PaginationInputError,
  buildCursorPage,
  decodeCursor,
  encodeCursor,
  normalizeLimit,
} from "@/lib/pagination";

test("normalizeLimit clamps values into configured range", () => {
  assert.equal(normalizeLimit(undefined), 20);
  assert.equal(normalizeLimit(0), 20);
  assert.equal(normalizeLimit(1), 1);
  assert.equal(normalizeLimit(999), 100);
  assert.equal(normalizeLimit(5.8), 5);
});

test("encodeCursor and decodeCursor round trip payloads", () => {
  const raw = encodeCursor({
    sortTime: "2026-05-19T10:00:00.000Z",
    storedAt: "2026-05-19T10:01:00.000Z",
    id: "550e8400-e29b-41d4-a716-446655440000",
  });

  const decoded = decodeCursor(raw, (value): value is { sortTime: string; storedAt: string; id: string } => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.sortTime === "string" &&
      typeof candidate.storedAt === "string" &&
      typeof candidate.id === "string"
    );
  });

  assert.deepEqual(decoded, {
    sortTime: "2026-05-19T10:00:00.000Z",
    storedAt: "2026-05-19T10:01:00.000Z",
    id: "550e8400-e29b-41d4-a716-446655440000",
  });
});

test("decodeCursor rejects malformed cursors", () => {
  assert.throws(
    () =>
      decodeCursor("bad-cursor", (_value): _value is { id: string } => true),
    PaginationInputError,
  );
});

test("buildCursorPage trims the lookahead row and emits nextCursor", () => {
  const page = buildCursorPage({
    rows: [
      { id: "1", sortTime: "2026-05-19T10:03:00.000Z" },
      { id: "2", sortTime: "2026-05-19T10:02:00.000Z" },
      { id: "3", sortTime: "2026-05-19T10:01:00.000Z" },
    ],
    limit: 2,
    getCursor: (item) => ({ id: item.id, sortTime: item.sortTime }),
  });

  assert.equal(page.items.length, 2);
  assert.equal(page.items[1]?.id, "2");
  assert.equal(page.pagination.hasMore, true);
  assert.notEqual(page.pagination.nextCursor, null);
});

test("buildCursorPage omits nextCursor on the last page", () => {
  const page = buildCursorPage({
    rows: [{ id: "1", sortTime: "2026-05-19T10:03:00.000Z" }],
    limit: 2,
    getCursor: (item) => ({ id: item.id, sortTime: item.sortTime }),
  });

  assert.equal(page.items.length, 1);
  assert.equal(page.pagination.hasMore, false);
  assert.equal(page.pagination.nextCursor, null);
});
