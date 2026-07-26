// KB articles — list + create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, auditCtx } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { createArticle } from "@/lib/modules/knowledge-base/service";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(10),
  excerpt: z.string().optional(),
  category: z.string().default("GENERAL"),
  tags: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "kb:read");
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const status = url.searchParams.get("status") || "PUBLISHED";
    const items = await db.kbArticle.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(session?.role === "ADMIN" ? {} : { status }),
      },
      orderBy: [{ pinnedToTop: "desc" }, { publishedAt: "desc" }],
      take: 50,
      select: {
        id: true, slug: true, title: true, excerpt: true, category: true, tags: true,
        status: true, viewsCount: true, helpfulCount: true, publishedAt: true, updatedAt: true,
      },
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "kb:write");
    const body = await parseJson(req, createSchema);
    const article = await createArticle({ ...body, authorId: session?.sub });
    await writeAudit({ ctx: auditCtx(req, session), action: "kb.article_create", resourceType: "KbArticle", resourceId: article.id });
    return { article };
  });
}
