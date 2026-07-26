// Dispatch endpoint — list pending dispatch, dispatch a booking
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { autoDispatch } from "@/lib/modules/dispatch/service";
import { z } from "zod";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "dispatch:read");
    // Bookings needing dispatch (status requested or assigned with no accepted assignment)
    const items = await db.booking.findMany({
      where: {
        status: { in: ["requested", "assigned"] },
        deletedAt: null,
      },
      include: {
        serviceType: true,
        address: true,
        customer: { include: { user: true } },
        assignments: { include: { worker: { include: { user: true } } } },
      },
      orderBy: { scheduledStart: "asc" },
      take: 100,
    });
    return { items };
  });
}

const dispatchSchema = z.object({ bookingId: z.string() });

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "dispatch:override");
    const body = await parseJson(req, dispatchSchema);
    return autoDispatch(body.bookingId);
  });
}
