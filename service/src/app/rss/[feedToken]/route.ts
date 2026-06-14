import { buildCachedFeedXml } from "@/lib/rss";
import { listItemsByFeedToken } from "@/lib/item-service";
import { cachedJson } from "@/lib/redis-cache";

type RouteContext = {
  params: Promise<{
    feedToken: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { feedToken } = await context.params;
  const { searchParams } = new URL(request.url);
  const rawToken = feedToken.endsWith(".xml") ? feedToken.slice(0, -4) : feedToken;
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;
  const xml = await cachedJson("rss-feed", [rawToken, limit], 120, async () => {
    const items = await listItemsByFeedToken(rawToken, limit);
    return buildCachedFeedXml(rawToken, items);
  });

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=300",
    },
  });
}
