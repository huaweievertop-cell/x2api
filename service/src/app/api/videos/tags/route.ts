import { requireClient } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listVideoTags } from "@/lib/video-feed-service";
import { cachedJson } from "@/lib/redis-cache";

export async function GET() {
  try {
    await requireClient();
    const tags = await cachedJson("video-tags", [], 600, listVideoTags);
    return jsonOk({ tags });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query video tags.";
    if (message === "Missing API key." || message === "Invalid API key.") {
      return jsonError(message, 401);
    }
    return jsonError(message, 500);
  }
}
