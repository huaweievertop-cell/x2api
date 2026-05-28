import { requireClient } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { listVideoCategories } from "@/lib/video-feed-service";

export async function GET() {
  try {
    await requireClient();
    const categories = await listVideoCategories();
    return jsonOk({ categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to query video categories.";
    if (message === "Missing API key." || message === "Invalid API key.") {
      return jsonError(message, 401);
    }
    return jsonError(message, 500);
  }
}
