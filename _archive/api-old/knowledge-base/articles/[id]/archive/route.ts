import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { archiveArticle } from "@/lib/modules/knowledge-base/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "kb:admin");
    const { id } = await ctx.params;
    return { article: await archiveArticle(id) };
  });
}
