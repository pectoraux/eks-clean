// Subscriptions API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound, unauthorized, forbidden } from "@/lib/utils/api";
import { getPaymentGateway } from "@/lib/payment/payswap-gateway";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;

    let where: Record<string, unknown> = { deletedAt: null };
    if (session.role === "CUSTOMER") {
      const c = await db.customer.findUnique({ where: { userId: session.sub } });
      if (!c) throw notFound();
      where.customerId = c.id;
    }
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      db.subscription.findMany({
        where,
        include: { plan: { include: { serviceType: true } }, customer: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.subscription.count({ where }),
    ]);
    return { items, total };
  });
}

const createSchema = z.object({
  planId: z.string(),
  autoRenew: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    const s = requirePerm(session, "subscriptions:manage");
    const body = await parseJson(req, createSchema);

    const customer = await db.customer.findUnique({ where: { userId: s.sub } });
    if (!customer) throw notFound("Customer profile not found");
    const plan = await db.subscriptionPlan.findUnique({
      where: { id: body.planId },
      include: { serviceType: true },
    });
    if (!plan || !plan.isActive) throw notFound("Plan not found or inactive");

    // Delegate recurring billing to Payswap
    const gateway = getPaymentGateway();
    let payswapSubId: string | undefined;
    if (customer.payswapCustomerId && plan.payswapPriceId) {
      const r = await gateway.createSubscription({
        customerId: customer.payswapCustomerId,
        priceId: plan.payswapPriceId,
        metadata: { planId: plan.id, customerId: customer.id },
      });
      payswapSubId = r.payswapSubscriptionId;
    }

    const sub = await db.subscription.create({
      data: {
        customerId: customer.id,
        planId: body.planId,
        payswapSubscriptionId: payswapSubId,
        status: "ACTIVE",
        autoRenew: body.autoRenew,
        nextBillingDate: new Date(Date.now() + plan.cadenceDays * 24 * 60 * 60 * 1000),
      },
      include: { plan: { include: { serviceType: true } } },
    });

    await writeAudit({
      action: "subscription.create",
      resourceType: "Subscription",
      resourceId: sub.id,
    });
    return { subscription: sub };
  });
}
