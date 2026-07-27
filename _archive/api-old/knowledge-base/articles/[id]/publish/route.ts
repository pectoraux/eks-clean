import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { publishArticle } from "@/lib/modules/knowledge-base/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "kb:publish");
    const { id } = await ctx.params;
    return { article: await publishArticle(id) };
  });
}
