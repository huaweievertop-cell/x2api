export class PaginationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaginationInputError";
  }
}

export type CursorPagination = {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type CursorPageResult<T> = {
  items: T[];
  pagination: CursorPagination;
};

type CursorEnvelope<T> = {
  v: 1;
  payload: T;
};

type NormalizeLimitOptions = {
  defaultLimit?: number;
  maxLimit?: number;
};

type BuildCursorPageOptions<TItem, TCursor extends Record<string, unknown>> = {
  rows: TItem[];
  limit: number;
  getCursor: (item: TItem) => TCursor;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeLimit(limit?: number, options?: NormalizeLimitOptions) {
  const defaultLimit = options?.defaultLimit ?? 20;
  const maxLimit = options?.maxLimit ?? 100;

  if (!limit || Number.isNaN(limit)) {
    return defaultLimit;
  }

  return Math.min(Math.max(Math.floor(limit), 1), maxLimit);
}

export function encodeCursor<T extends Record<string, unknown>>(payload: T) {
  const envelope: CursorEnvelope<T> = {
    v: 1,
    payload,
  };

  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

export function decodeCursor<T>(
  rawCursor: string | null | undefined,
  validate: (value: unknown) => value is T,
): T | null {
  if (!rawCursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(rawCursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);

    if (!isRecord(parsed) || parsed.v !== 1 || !("payload" in parsed) || !validate(parsed.payload)) {
      throw new PaginationInputError("Invalid cursor.");
    }

    return parsed.payload;
  } catch (error) {
    if (error instanceof PaginationInputError) {
      throw error;
    }

    throw new PaginationInputError("Invalid cursor.");
  }
}

export function buildCursorPage<TItem, TCursor extends Record<string, unknown>>(
  options: BuildCursorPageOptions<TItem, TCursor>,
): CursorPageResult<TItem> {
  const { rows, limit, getCursor } = options;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items[items.length - 1];

  return {
    items,
    pagination: {
      limit,
      nextCursor: hasMore && lastItem ? encodeCursor(getCursor(lastItem)) : null,
      hasMore,
    },
  };
}
