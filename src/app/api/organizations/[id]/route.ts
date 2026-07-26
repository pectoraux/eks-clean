// Organization metrics
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, notFound } from "@/lib/utils/api";
import { organizationMetrics } from "@/lib/modules/multi-tenant/service";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "admin:users" as never);
    const { id } = await ctx.params;
    return organizationMetrics(id);
  });
}
