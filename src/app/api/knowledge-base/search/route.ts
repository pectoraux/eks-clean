// KB search
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { searchArticles } from "@/lib/modules/knowledge-base/service";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "kb:read");
    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const category = url.searchParams.get("category") || undefined;
    const tags = url.searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const limit = Number(url.searchParams.get("limit") ?? 20);
    return { items: await searchArticles(q, { category, tags, limit }) };
  });
}
