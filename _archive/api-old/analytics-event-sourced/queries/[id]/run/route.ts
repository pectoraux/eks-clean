import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { runQuery } from "@/lib/modules/analytics-event-sourced/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:events:read");
    const { id } = await ctx.params;
    return runQuery(id, session?.sub);
  });
}
