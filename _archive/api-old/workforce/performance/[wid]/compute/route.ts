// Performance scoring — compute + list
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { computePerformanceScore } from "@/lib/modules/workforce/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ wid: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:read");
    const { wid } = await ctx.params;
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || new Date().toISOString().slice(0, 7);
    const items = await db.workerPerformanceScore.findMany({
      where: { workerId: wid },
      orderBy: { period: "desc" },
      take: 12,
    });
    return { items };
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ wid: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:performance:review");
    const { wid } = await ctx.params;
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || new Date().toISOString().slice(0, 7);
    return { score: await computePerformanceScore(wid, period) };
  });
}
