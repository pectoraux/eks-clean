import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { rebuildProjection } from "@/lib/modules/analytics-event-sourced/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:projections:manage");
    const { name } = await ctx.params;
    return rebuildProjection(name);
  });
}
