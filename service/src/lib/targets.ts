export type TargetKind = "user" | "keyword";

export type ParsedTarget = {
  kind: TargetKind;
  value: string;
  normalizedValue: string;
  category?: string | null;
  tags: string[];
};

const MAX_TARGET_TAGS = 12;
const MAX_TARGET_TAG_LENGTH = 40;
const MAX_TARGET_CATEGORY_LENGTH = 80;

export function parseTarget(raw: string): ParsedTarget {
  const value = raw.trim();
  if (!value) {
    throw new Error("Target cannot be empty.");
  }

  if (value.startsWith("search:")) {
    const keyword = value.slice("search:".length).trim();
    if (!keyword) {
      throw new Error("Keyword target cannot be empty.");
    }
    return {
      kind: "keyword",
      value: keyword,
      normalizedValue: keyword.toLowerCase(),
      tags: [],
    };
  }

  return {
    kind: "user",
    value,
    normalizedValue: value.toLowerCase(),
    tags: [],
  };
}

export function formatTarget(target: ParsedTarget | { kind: TargetKind; value: string }): string {
  return target.kind === "keyword" ? `search:${target.value}` : target.value;
}

function normalizeTargetTag(rawTag: unknown) {
  if (typeof rawTag !== "string") {
    throw new Error("Each target tag must be a string.");
  }

  const tag = rawTag.trim();
  if (!tag) {
    return null;
  }
  if (tag.length > MAX_TARGET_TAG_LENGTH) {
    throw new Error(`Target tag cannot exceed ${MAX_TARGET_TAG_LENGTH} characters.`);
  }

  return tag;
}

function normalizeTargetTags(rawTags: unknown) {
  if (rawTags === undefined || rawTags === null) {
    return [];
  }
  if (!Array.isArray(rawTags)) {
    throw new Error("Target tags must be an array.");
  }

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rawTag of rawTags) {
    const tag = normalizeTargetTag(rawTag);
    if (!tag) {
      continue;
    }

    const key = tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    tags.push(tag);
    if (tags.length > MAX_TARGET_TAGS) {
      throw new Error(`Each target can have at most ${MAX_TARGET_TAGS} tags.`);
    }
  }

  return tags;
}

function normalizeTargetCategory(rawCategory: unknown) {
  if (typeof rawCategory !== "string") {
    throw new Error("Target category must be a string.");
  }

  const category = rawCategory.trim();
  if (!category) {
    throw new Error("Target category is required.");
  }
  if (category.length > MAX_TARGET_CATEGORY_LENGTH) {
    throw new Error(`Target category cannot exceed ${MAX_TARGET_CATEGORY_LENGTH} characters.`);
  }

  return category;
}

function parseTargetInput(rawTarget: unknown) {
  if (typeof rawTarget === "string") {
    return parseTarget(rawTarget);
  }

  if (!rawTarget || typeof rawTarget !== "object" || Array.isArray(rawTarget)) {
    throw new Error("Each target must be a string or an object.");
  }

  const candidate = rawTarget as { target?: unknown; category?: unknown; tags?: unknown };
  if (typeof candidate.target !== "string") {
    throw new Error("Each target object must include a string target.");
  }
  if (candidate.category === undefined || candidate.category === null) {
    throw new Error("Target category is required.");
  }

  return {
    ...parseTarget(candidate.target),
    category: normalizeTargetCategory(candidate.category),
    tags: normalizeTargetTags(candidate.tags),
  };
}

export function parseTargets(rawTargets: unknown): ParsedTarget[] {
  if (!Array.isArray(rawTargets)) {
    throw new Error("Expected an array of targets.");
  }

  const seen = new Set<string>();
  const parsed: ParsedTarget[] = [];

  for (const rawTarget of rawTargets) {
    const target = parseTargetInput(rawTarget);
    const key = `${target.kind}:${target.normalizedValue}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    parsed.push(target);
  }

  return parsed;
}
