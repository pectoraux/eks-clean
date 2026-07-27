import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { createPaymentIntentForBooking } from "@/lib/modules/payments/service";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "bookings:read");
    const { id } = await ctx.params;
    const result = await createPaymentIntentForBooking(id);
    await writeAudit({
      action: "payment.intent_create",
      resourceType: "Booking",
      resourceId: id,
    });
    return result;
  });
}
