// Pause / resume / cancel subscription
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound, forbidden } from "@/lib/utils/api";
import { getPaymentGateway } from "@/lib/payment/payswap-gateway";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

async function getOwned(req: NextRequest, id: string) {
  const session = await getSessionFromHeaders(req.headers);
  if (!session) throw new Error("Unauthorized");
  const sub = await db.subscription.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!sub) throw notFound();
  if (session.role === "CUSTOMER") {
    const c = await db.customer.findUnique({ where: { userId: session.sub } });
    if (c?.id !== sub.customerId) throw forbidden();
  }
  return { session, sub };
}

const reasonSchema = z.object({ reason: z.string().max(500).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await ctx.params;
    const { session, sub } = await getOwned(req, id);
    requirePerm(session, "subscriptions:manage");

    if (sub.payswapSubscriptionId) {
      const gateway = getPaymentGateway();
      await gateway.cancelSubscription(sub.payswapSubscriptionId);
    }
    const updated = await db.subscription.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), autoRenew: false },
    });
    await writeAudit({
      action: "subscription.cancel",
      resourceType: "Subscription",
      resourceId: id,
    });
    return { subscription: updated };
  });
}
