// KB article actions: publish, archive, feedback, view
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { publishArticle, archiveArticle, recordFeedback, recordView, updateArticle } from "@/lib/modules/knowledge-base/service";
import { z } from "zod";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "kb:read");
    const { id } = await ctx.params;
    const article = await db.kbArticle.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" }, take: 5 } },
    });
    if (!article) throw notFound("Article not found");
    // Track view (fire-and-forget)
    recordView(id).catch(() => {});
    return { article };
  });
}

const updateSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  excerpt: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  changeSummary: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "kb:write");
    const { id } = await ctx.params;
    const body = await parseJson(req, updateSchema);
    return { article: await updateArticle(id, { ...body, editedBy: session?.sub }) };
  });
}
