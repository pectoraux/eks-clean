// Projections — rebuild + read
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { rebuildProjection, readProjection } from "@/lib/modules/analytics-event-sourced/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:events:read");
    const { name } = await ctx.params;
    const url = new URL(req.url);
    const aggregateKey = url.searchParams.get("aggregateKey") || undefined;
    return { items: await readProjection(name, aggregateKey) };
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:projections:manage");
    const { name } = await ctx.params;
    return rebuildProjection(name);
  });
}
