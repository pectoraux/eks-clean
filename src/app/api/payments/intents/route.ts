// Payments — list intents, capture, refund, payouts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, unauthorized, notFound } from "@/lib/utils/api";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const limit = Number(url.searchParams.get("limit") ?? 50);

    let where: Record<string, unknown> = {};
    if (session.role === "CUSTOMER") {
      const c = await db.customer.findUnique({ where: { userId: session.sub } });
      where.customerId = c?.id;
    }
    if (status) where.status = status;

    const items = await db.paymentIntent.findMany({
      where,
      include: { booking: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return { items };
  });
}
