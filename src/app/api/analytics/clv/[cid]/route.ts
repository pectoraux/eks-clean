import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { customerLifetimeValue } from "@/lib/modules/analytics-advanced/service";

export async function GET(req: NextRequest, ctx: { params: Promise<{ cid: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:read");
    const { cid } = await ctx.params;
    return customerLifetimeValue(cid);
  });
}
