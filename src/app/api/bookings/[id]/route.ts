import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, unauthorized, notFound, forbidden, parseJson } from "@/lib/utils/api";
import { transitionStatus } from "@/lib/modules/bookings/service";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";
import type { BookingStatus } from "@/lib/types";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const { id } = await ctx.params;
    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        serviceType: true,
        address: true,
        customer: { include: { user: true } },
        assignments: { include: { worker: { include: { user: true } } } },
        ratings: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!booking) throw notFound();
    if (session.role === "CUSTOMER") {
      const c = await db.customer.findUnique({ where: { userId: session.sub } });
      if (c?.id !== booking.customerId) throw forbidden();
    }
    return { booking };
  });
}

const statusSchema = z.object({
  toStatus: z.enum([
    "draft",
    "requested",
    "assigned",
    "worker_accepted",
    "worker_en_route",
    "arrived",
    "in_progress",
    "completed",
    "rated",
    "cancelled",
    "disputed",
  ] as const),
  reason: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const { id } = await ctx.params;
    const body = await parseJson(req, statusSchema);
    const booking = await db.booking.findUnique({ where: { id } });
    if (!booking) throw notFound();

    // Customer can cancel only
    if (session.role === "CUSTOMER") {
      const c = await db.customer.findUnique({ where: { userId: session.sub } });
      if (c?.id !== booking.customerId) throw forbidden();
      if (body.toStatus !== "cancelled") throw forbidden();
    }

    const actorType = session.role === "CUSTOMER" ? "CUSTOMER"
      : session.role === "WORKER" ? "WORKER"
      : session.role === "ADMIN" || session.role === "FIELD_MANAGER" ? "ADMIN"
      : "SYSTEM";

    const updated = await transitionStatus(id, body.toStatus as BookingStatus, {
      id: session.sub,
      type: actorType,
    }, body.reason);

    await writeAudit({
      action: "booking.status_change",
      resourceType: "Booking",
      resourceId: id,
      after: { to: body.toStatus, reason: body.reason },
    });

    return { booking: updated };
  });
}
