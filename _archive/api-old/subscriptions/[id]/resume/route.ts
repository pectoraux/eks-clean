import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, notFound, forbidden } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "subscriptions:manage");
    const { id } = await ctx.params;
    const sub = await db.subscription.findUnique({ where: { id }, include: { customer: true } });
    if (!sub) throw notFound();
    if (session.role === "CUSTOMER") {
      const c = await db.customer.findUnique({ where: { userId: session.sub } });
      if (c?.id !== sub.customerId) throw forbidden();
    }
    const updated = await db.subscription.update({
      where: { id },
      data: { status: "ACTIVE", pausedAt: null },
    });
    await writeAudit({
      action: "subscription.resume",
      resourceType: "Subscription",
      resourceId: id,
    });
    return { subscription: updated };
  });
}
