import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { assignAddon } from "@/lib/modules/subscriptions-advanced/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "subscriptions:addons:manage");
    const { id } = await ctx.params;
    return { assignment: await assignAddon(id, session!.sub, { id: session?.sub, type: session?.role }) };
  });
}
