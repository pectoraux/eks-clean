import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { refundPaymentIntent } from "@/lib/modules/payments/service";
import { z } from "zod";

const refundSchema = z.object({
  amountMinor: z.number().int().min(1).optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "payments:refund");
    const { id } = await ctx.params;
    const body = await parseJson(req, refundSchema);
    return refundPaymentIntent(id, body.amountMinor, body.reason);
  });
}
