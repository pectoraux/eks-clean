import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { capturePaymentIntent } from "@/lib/modules/payments/service";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "payments:read");
    const { id } = await ctx.params;
    return capturePaymentIntent(id);
  });
}
