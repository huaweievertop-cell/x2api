import { getSql } from "@/lib/db";
import { buildCursorPage, decodeCursor, normalizeLimit } from "@/lib/pagination";
import { asRows } from "@/lib/sql-result";

type ItemQuery = {
  clientId: string;
  limit?: number;
  cursor?: string | null;
  keyword?: string | null;
  target?: string | null;
  since?: string | null;
};

export type ItemPagination = {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type ListItemsResult = {
  items: ItemRecord[];
  pagination: ItemPagination;
};

export type ItemRecord = {
  id: string;
  target: string;
  kind: "user" | "keyword";
  author: string | null;
  title: string | null;
  content: string | null;
  rawContent: string | null;
  translatedContent: string | null;
  link: string | null;
  xUrl: string | null;
  images: string[];
  videoUrl: string | null;
  publishedAt: string | null;
  storedAt: string;
  guid: string;
  isRetweet: boolean;
};

type ItemCursor = {
  sortTime: string;
  storedAt: string;
  id: string;
};

type ItemRow = ItemRecord & {
  sortTime: string;
};

function isItemCursor(value: unknown): value is ItemCursor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<ItemCursor>;
  return (
    typeof candidate.sortTime === "string" &&
    typeof candidate.storedAt === "string" &&
    typeof candidate.id === "string"
  );
}

export async function listItems(query: ItemQuery): Promise<ListItemsResult> {
  const sql = getSql();
  const limit = normalizeLimit(query.limit);
  const cursor = decodeCursor(query.cursor, isItemCursor);
  const searchText = query.keyword?.trim() ? `%${query.keyword.trim().toLowerCase()}%` : null;
  const targetFilter = query.target?.trim().toLowerCase() || null;
  const sinceFilter = query.since ? new Date(query.since).toISOString() : null;
  const filters = sql`
    FROM subscriptions s
    INNER JOIN targets t ON t.id = s.target_id
    INNER JOIN items i ON i.target_id = t.id
    WHERE s.client_id = ${query.clientId}
      AND (
        ${searchText}::text IS NULL
        OR LOWER(COALESCE(i.content, '')) LIKE ${searchText}
        OR LOWER(COALESCE(i.raw_content, '')) LIKE ${searchText}
        OR LOWER(COALESCE(i.translated_content, '')) LIKE ${searchText}
        OR LOWER(COALESCE(i.author, '')) LIKE ${searchText}
      )
      AND (
        ${targetFilter}::text IS NULL
        OR LOWER(
          CASE
            WHEN t.kind = 'keyword' THEN 'search:' || t.value
            ELSE t.value
          END
        ) = ${targetFilter}
      )
      AND (
        ${sinceFilter}::timestamptz IS NULL
        OR i.stored_at >= ${sinceFilter}::timestamptz
      )
      AND (
        ${cursor?.sortTime ?? null}::timestamptz IS NULL
        OR (
          ROW(
            COALESCE(i.published_at, i.stored_at),
            i.stored_at,
            i.id
          ) < ROW(
            ${cursor?.sortTime ?? null}::timestamptz,
            ${cursor?.storedAt ?? null}::timestamptz,
            ${cursor?.id ?? null}::uuid
          )
        )
      )
  `;

  const rows = asRows<ItemRow>(await sql`
    SELECT
      i.id,
      CASE
        WHEN t.kind = 'keyword' THEN 'search:' || t.value
        ELSE t.value
      END AS target,
      t.kind,
      i.author,
      i.title,
      i.content,
      i.raw_content AS "rawContent",
      i.translated_content AS "translatedContent",
      i.link,
      i.x_url AS "xUrl",
      ARRAY(
        SELECT jsonb_array_elements_text(i.images)
      ) AS images,
      i.video_url AS "videoUrl",
      i.published_at AS "publishedAt",
      i.stored_at AS "storedAt",
      COALESCE(i.published_at, i.stored_at) AS "sortTime",
      i.guid,
      i.is_retweet AS "isRetweet"
    ${filters}
    ORDER BY "sortTime" DESC, "storedAt" DESC, i.id DESC
    LIMIT ${limit + 1}
  `);

  const page = buildCursorPage({
    rows,
    limit,
    getCursor: (item) => ({
      sortTime: item.sortTime,
      storedAt: item.storedAt,
      id: item.id,
    }),
  });

  return {
    items: page.items.map(({ sortTime: _sortTime, ...item }) => item),
    pagination: {
      limit,
      nextCursor: page.pagination.nextCursor,
      hasMore: page.pagination.hasMore,
    },
  };
}

export async function listItemsByFeedToken(feedToken: string, limit = 50) {
  const sql = getSql();
  const normalizedLimit = normalizeLimit(limit);

  const rows = asRows<ItemRecord>(await sql`
    SELECT
      i.id,
      CASE
        WHEN t.kind = 'keyword' THEN 'search:' || t.value
        ELSE t.value
      END AS target,
      t.kind,
      i.author,
      i.title,
      i.content,
      i.raw_content AS "rawContent",
      i.translated_content AS "translatedContent",
      i.link,
      i.x_url AS "xUrl",
      ARRAY(
        SELECT jsonb_array_elements_text(i.images)
      ) AS images,
      i.video_url AS "videoUrl",
      i.published_at AS "publishedAt",
      i.stored_at AS "storedAt",
      i.guid,
      i.is_retweet AS "isRetweet"
    FROM clients c
    INNER JOIN subscriptions s ON s.client_id = c.id
    INNER JOIN targets t ON t.id = s.target_id
    INNER JOIN items i ON i.target_id = t.id
    WHERE c.feed_token = ${feedToken}
      AND c.status = 'active'
    ORDER BY COALESCE(i.published_at, i.stored_at) DESC, i.stored_at DESC
    LIMIT ${normalizedLimit}
  `);

  return rows;
}
