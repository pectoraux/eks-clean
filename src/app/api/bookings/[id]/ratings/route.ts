// Ratings API — submit a rating for a booking, list ratings
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound, conflict, unauthorized } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { publish } from "@/lib/events/bus";
import { z } from "zod";

const ratingSchema = z.object({
  punctuality: z.number().int().min(1).max(5),
  professionalism: z.number().int().min(1).max(5),
  cleanliness: z.number().int().min(1).max(5),
  friendliness: z.number().int().min(1).max(5),
  overall: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  photoUrls: z.array(z.string().url()).max(5).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    const s = requirePerm(session, "quality:rate");
    const { id } = await ctx.params;
    const body = await parseJson(req, ratingSchema);

    const booking = await db.booking.findUnique({
      where: { id },
      include: { assignments: true },
    });
    if (!booking) throw notFound();
    if (booking.status !== "completed" && booking.status !== "rated") {
      throw conflict("Booking must be completed before rating");
    }

    const customer = await db.customer.findUnique({ where: { userId: s.sub } });
    if (!customer || customer.id !== booking.customerId) {
      throw unauthorized();
    }

    const existing = await db.rating.findUnique({ where: { bookingId: id } });
    if (existing) throw conflict("Already rated");

    const workerAssignment = booking.assignments.find((a) => a.status === "ACCEPTED");
    if (!workerAssignment) throw conflict("No accepted worker assignment to rate");

    const rating = await db.rating.create({
      data: {
        bookingId: id,
        customerId: customer.id,
        workerId: workerAssignment.workerId,
        punctuality: body.punctuality,
        professionalism: body.professionalism,
        cleanliness: body.cleanliness,
        friendliness: body.friendliness,
        overall: body.overall,
        comment: body.comment,
        photoUrls: body.photoUrls ? JSON.stringify(body.photoUrls) : null,
      },
    });

    // Update worker aggregate rating
    const worker = await db.worker.findUnique({ where: { id: workerAssignment.workerId } });
    if (worker) {
      const newCount = worker.totalRatings + 1;
      const newAvg = (worker.averageRating * worker.totalRatings + body.overall) / newCount;
      await db.worker.update({
        where: { id: worker.id },
        data: { averageRating: newAvg, totalRatings: newCount },
      });
    }

    // Move booking to "rated"
    await db.booking.update({ where: { id }, data: { status: "rated" } });
    await db.bookingStatusHistory.create({
      data: { bookingId: id, fromStatus: "completed", toStatus: "rated", actorId: s.sub, actorType: "CUSTOMER" },
    });

    await publish({
      eventType: "rating.created",
      bookingId: id,
      payload: { workerId: workerAssignment.workerId, overall: body.overall },
    });

    await writeAudit({
      action: "rating.create",
      resourceType: "Rating",
      resourceId: rating.id,
    });

    return { rating };
  });
}
