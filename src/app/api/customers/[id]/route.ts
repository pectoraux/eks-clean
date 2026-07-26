import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, unauthorized, notFound, forbidden } from "@/lib/utils/api";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const { id } = await ctx.params;
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, fullName: true, phone: true, role: true, status: true, lastLoginAt: true } },
        addresses: true,
        householdProfiles: true,
        subscriptions: { include: { plan: { include: { serviceType: true } } } },
        favorites: { include: { worker: { include: { user: true } } } },
        _count: { select: { bookings: true, ratings: true } },
      },
    });
    if (!customer) throw notFound();
    if (session.role === "CUSTOMER") {
      const c = await db.customer.findUnique({ where: { userId: session.sub } });
      if (c?.id !== id) throw forbidden();
    }
    return { customer };
  });
}
