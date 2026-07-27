// Subscription dunning: start + resolve
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { startDunning, resolveDunning } from "@/lib/modules/subscriptions-advanced/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "subscriptions:dunning:manage");
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "start";
    if (action === "start") return startDunning(id);
    if (action === "resolve") return resolveDunning(id);
    return { error: "Unknown action" };
  });
}
