/**
 * ============================================================================
 *  Knowledge Base — articles, versions, search, feedback, helpfulness scoring
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function buildSearchVector(a: { title: string; excerpt: string | null; tags: string[]; body: string }): string {
  return [a.title, a.excerpt ?? "", a.tags.join(" "), a.body].join(" ").toLowerCase();
}

// ---------------------------------------------------------------------------
//  CRUD
// ---------------------------------------------------------------------------

export async function createArticle(input: {
  title: string;
  body: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  authorId?: string;
}) {
  const slug = slugify(input.title) + "-" + Math.random().toString(36).slice(2, 6);
  const article = await db.kbArticle.create({
    data: {
      slug,
      title: input.title,
      body: input.body,
      excerpt: input.excerpt,
      category: input.category ?? "GENERAL",
      tags: input.tags ?? [],
      authorId: input.authorId,
      searchVector: buildSearchVector({
        title: input.title,
        excerpt: input.excerpt ?? null,
        tags: input.tags ?? [],
        body: input.body,
      }),
    },
  });
  // Initial version snapshot
  await db.kbArticleVersion.create({
    data: {
      articleId: article.id,
      version: 1,
      title: input.title,
      body: input.body,
      excerpt: input.excerpt,
      editedBy: input.authorId,
      changeSummary: "Initial creation",
    },
  });
  await publish({ eventType: "kb.article_created", payload: { articleId: article.id, slug } });
  return article;
}

export async function updateArticle(id: string, input: {
  title?: string;
  body?: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  editedBy?: string;
  changeSummary?: string;
}) {
  const existing = await db.kbArticle.findUnique({ where: { id } });
  if (!existing) throw notFound("Article not found");

  const next: Record<string, unknown> = { ...input };
  delete next.editedBy;
  delete next.changeSummary;

  // Recompute search vector if any text field changed
  if (input.title || input.body || input.excerpt || input.tags) {
    next.searchVector = buildSearchVector({
      title: input.title ?? existing.title,
      excerpt: input.excerpt ?? existing.excerpt,
      tags: input.tags ?? existing.tags,
      body: input.body ?? existing.body,
    });
  }

  const updated = await db.kbArticle.update({
    where: { id },
    data: next,
  });

  // Save a new version snapshot
  const lastVersion = await db.kbArticleVersion.findFirst({
    where: { articleId: id },
    orderBy: { version: "desc" },
  });
  await db.kbArticleVersion.create({
    data: {
      articleId: id,
      version: (lastVersion?.version ?? 0) + 1,
      title: updated.title,
      body: updated.body,
      excerpt: updated.excerpt,
      editedBy: input.editedBy,
      changeSummary: input.changeSummary,
    },
  });

  await publish({ eventType: "kb.article_updated", payload: { articleId: id, version: (lastVersion?.version ?? 0) + 1 } });
  return updated;
}

export async function publishArticle(id: string) {
  const article = await db.kbArticle.findUnique({ where: { id } });
  if (!article) throw notFound("Article not found");
  if (article.status === "PUBLISHED") throw conflict("Already published");
  return db.kbArticle.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
}

export async function archiveArticle(id: string) {
  return db.kbArticle.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
}

// ---------------------------------------------------------------------------
//  Search — simple ILIKE against precomputed search vector
//  (Postgres full-text search or pgvector can be plugged in later)
// ---------------------------------------------------------------------------

export async function searchArticles(query: string, opts: { category?: string; limit?: number; tags?: string[] } = {}) {
  const q = query.toLowerCase().trim();
  if (!q) {
    return db.kbArticle.findMany({
      where: {
        status: "PUBLISHED",
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.tags && opts.tags.length ? { tags: { hasSome: opts.tags } } : {}),
      },
      orderBy: [{ pinnedToTop: "desc" }, { publishedAt: "desc" }],
      take: opts.limit ?? 20,
      select: { id: true, slug: true, title: true, excerpt: true, category: true, tags: true, viewsCount: true, helpfulCount: true, publishedAt: true },
    });
  }
  // Use Postgres ILIKE on the precomputed search vector
  const items = await db.kbArticle.findMany({
    where: {
      status: "PUBLISHED",
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.tags && opts.tags.length ? { tags: { hasSome: opts.tags } } : {}),
      searchVector: { contains: q },
    },
    orderBy: [{ pinnedToTop: "desc" }, { viewsCount: "desc" }],
    take: opts.limit ?? 20,
    select: { id: true, slug: true, title: true, excerpt: true, category: true, tags: true, viewsCount: true, helpfulCount: true, publishedAt: true },
  });
  return items;
}

// ---------------------------------------------------------------------------
//  View tracking + feedback
// ---------------------------------------------------------------------------

export async function recordView(id: string) {
  await db.kbArticle.update({
    where: { id },
    data: { viewsCount: { increment: 1 } },
  });
}

export async function recordFeedback(articleId: string, helpful: boolean, comment?: string, userId?: string) {
  const article = await db.kbArticle.findUnique({ where: { id: articleId } });
  if (!article) throw notFound("Article not found");
  await db.kbArticleFeedback.create({
    data: { articleId, helpful, comment, userId },
  });
  await db.kbArticle.update({
    where: { id: articleId },
    data: helpful
      ? { helpfulCount: { increment: 1 } }
      : { notHelpfulCount: { increment: 1 } },
  });
  return { helpfulRatio: article.helpfulCount / Math.max(1, article.helpfulCount + article.notHelpfulCount) };
}

// ---------------------------------------------------------------------------
//  KB metrics
// ---------------------------------------------------------------------------

export async function kbMetrics() {
  const [total, published, drafts, totalViews, totalHelpful] = await Promise.all([
    db.kbArticle.count(),
    db.kbArticle.count({ where: { status: "PUBLISHED" } }),
    db.kbArticle.count({ where: { status: "DRAFT" } }),
    db.kbArticle.aggregate({ _sum: { viewsCount: true } }),
    db.kbArticle.aggregate({ _sum: { helpfulCount: true } }),
  ]);
  return {
    total,
    published,
    drafts,
    totalViews: totalViews._sum.viewsCount ?? 0,
    totalHelpfulVotes: totalHelpful._sum.helpfulCount ?? 0,
  };
}
