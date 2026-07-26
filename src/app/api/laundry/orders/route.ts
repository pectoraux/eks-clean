// Laundry orders — list and create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound, forbidden } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  bookingId: z.string(),
  totalGarments: z.number().int().min(1).default(1),
  totalWeightKg: z.number().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "bookings:update");
    const body = await parseJson(req, createSchema);
    const order = await db.laundryOrder.create({
      data: {
        bookingId: body.bookingId,
        totalGarments: body.totalGarments,
        totalWeightKg: body.totalWeightKg,
        notes: body.notes,
        status: "PICKUP_PENDING",
      },
      include: { booking: true },
    });
    await writeAudit({
      action: "laundry.order_create",
      resourceType: "LaundryOrder",
      resourceId: order.id,
    });
    return { order };
  });
}

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw forbidden("Login required");
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const items = await db.laundryOrder.findMany({
      where: { ...(status ? { status } : {}) },
      include: { booking: true, garments: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items };
  });
}
