import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, unauthorized, notFound, auditCtx } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { createBooking, listBookings } from "@/lib/modules/bookings/service";
import { z } from "zod";

const createSchema = z.object({
  serviceTypeId: z.string(),
  addressId: z.string(),
  householdProfileId: z.string().optional(),
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  workerCount: z.number().int().min(1).max(10).default(1),
  notes: z.string().max(2000).optional(),
  photoUrls: z.array(z.string().url()).max(10).optional(),
  source: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const serviceTypeId = url.searchParams.get("serviceTypeId") || undefined;
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    // Customers see only their own bookings; staff can see all
    let customerId: string | undefined;
    if (session.role === "CUSTOMER") {
      const c = await db.customer.findUnique({ where: { userId: session.sub } });
      if (!c) throw notFound("Customer profile not found");
      customerId = c.id;
    }

    return listBookings({ customerId, status, serviceTypeId, limit, offset });
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    const s = requirePerm(session, "bookings:create");
    const body = await parseJson(req, createSchema);

    const customer = await db.customer.findUnique({ where: { userId: s.sub } });
    if (!customer) throw notFound("Customer profile not found");

    const booking = await createBooking({
      customerId: customer.id,
      serviceTypeId: body.serviceTypeId,
      addressId: body.addressId,
      householdProfileId: body.householdProfileId,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      workerCount: body.workerCount,
      notes: body.notes,
      photoUrls: body.photoUrls,
      source: body.source,
    });

    await writeAudit({
      ctx: auditCtx(req, session),
      action: "booking.create",
      resourceType: "Booking",
      resourceId: booking.id,
      after: { code: booking.code, serviceTypeId: booking.serviceTypeId, totalMinor: booking.totalMinor },
    });

    return { booking };
  });
}
