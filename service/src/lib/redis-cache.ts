import { createHash } from "node:crypto";
import { createClient, type RedisClientType } from "redis";

let clientPromise: Promise<RedisClientType> | null = null;

function getRedisUrl() {
  return process.env.REDIS_URL?.trim() || "";
}

function getNamespace() {
  return process.env.REDIS_NAMESPACE?.trim() || "x2api";
}

async function getRedisClient() {
  const url = getRedisUrl();
  if (!url) {
    return null;
  }
  if (!clientPromise) {
    const client = createClient({ url }) as RedisClientType;
    client.on("error", (error) => {
      console.warn("[redis-cache] client error", error);
    });
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

function cacheKey(scope: string, parts: unknown[]) {
  const digest = createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
  return `${getNamespace()}:cache:${scope}:${digest}`;
}

export async function cacheGetJson<T>(scope: string, parts: unknown[]): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }
  try {
    const value = await client.get(cacheKey(scope, parts));
    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    console.warn(`[redis-cache] get failed scope=${scope}`, error);
    return null;
  }
}

export async function cacheSetJson(scope: string, parts: unknown[], value: unknown, ttlSeconds: number) {
  const client = await getRedisClient();
  if (!client) {
    return;
  }
  try {
    await client.set(cacheKey(scope, parts), JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    console.warn(`[redis-cache] set failed scope=${scope}`, error);
  }
}

export async function cachedJson<T>(scope: string, parts: unknown[], ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const cached = await cacheGetJson<T>(scope, parts);
  if (cached !== null) {
    return cached;
  }
  const value = await loader();
  await cacheSetJson(scope, parts, value, ttlSeconds);
  return value;
}
