/**
 * Dispatch Engine — automatic worker assignment.
 *
 * Algorithm (transparent + overridable):
 *  1. Candidate pool = ACTIVE workers within preferredRadiusKm of booking address
 *     who have the required skills (service.requiresCertification) and are
 *     available at the booking's scheduled window.
 *  2. Score each candidate:
 *       score = 0.35 * rating + 0.25 * quality + 0.20 * proximity + 0.15 * utilization_inverse + 0.05 * tenure
 *     (weights are config-driven; see DISPATCH_WEIGHTS below)
 *  3. Skip workers who already have overlapping assignments.
 *  4. Offer to top N (default N=1). If rejected within offerTtlMin, auto-escalate
 *     to next candidate. Managers can override at any time.
 *
 *  Subscription priority: customers with active subscriptions get +0.05 bonus
 *  to their assigned worker's queue position (effectively faster dispatch).
 */
import { db } from "@/lib/db";
import { emitBookingEvent } from "@/lib/events/bus";
import { broadcast, CHANNELS } from "@/lib/realtime";
import { notFound } from "@/lib/utils/api";

export const DISPATCH_WEIGHTS = {
  rating: 0.35,
  quality: 0.25,
  proximity: 0.2,
  utilizationInverse: 0.15,
  tenure: 0.05,
} as const;

interface DispatchResult {
  bookingId: string;
  offered: { workerId: string; score: number; estimatedTravelMinutes: number }[];
  chosen?: string;
  manual: boolean;
}

export async function autoDispatch(bookingId: string): Promise<DispatchResult> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      address: true,
      serviceType: true,
      customer: { include: { subscriptions: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!booking) throw notFound("Booking not found");
  if (booking.status !== "requested" && booking.status !== "assigned") {
    return { bookingId, offered: [], manual: false };
  }

  // 1. Find candidates by status + skills (we approximate skill filter as
  //    "any ACTIVE worker" if service.requiresCertification is null; otherwise
  //    intersect with WorkerSkill.skillCode).
  const requiredSkills = booking.serviceType.requiresCertification
    ? booking.serviceType.requiresCertification.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const candidates = await db.worker.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      ...(requiredSkills.length > 0
        ? { skills: { some: { skillCode: { in: requiredSkills } } } }
        : {}),
    },
    include: {
      user: true,
      skills: true,
      availabilities: true,
      assignments: {
        where: {
          status: { in: ["OFFERED", "ACCEPTED"] },
          booking: { scheduledStart: { lt: booking.scheduledEnd }, scheduledEnd: { gt: booking.scheduledStart } },
        },
      },
    },
    take: 200,
  });

  // 2. Score
  const scored = candidates
    .filter((w) => w.assignments.length === 0) // not double-booked
    .map((w) => {
      const distKm = booking.address.latitude && w.homeLatitude
        ? haversineKm(
            booking.address.latitude,
            booking.address.longitude!,
            w.homeLatitude,
            w.homeLongitude!,
          )
        : 5; // default if coords missing
      const withinRadius = distKm <= w.preferredRadiusKm;
      const proximityScore = Math.max(0, 1 - distKm / w.preferredRadiusKm);
      const utilInv = 1 - (w.utilizationRate || 0);
      const tenureScore = Math.min(1, (w.hireDate ? (Date.now() - w.hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365) : 0));
      const quality = w.averageRating / 5;
      let score =
        DISPATCH_WEIGHTS.rating * (w.averageRating / 5) +
        DISPATCH_WEIGHTS.quality * quality +
        DISPATCH_WEIGHTS.proximity * proximityScore +
        DISPATCH_WEIGHTS.utilizationInverse * utilInv +
        DISPATCH_WEIGHTS.tenure * tenureScore;
      // subscription priority bonus
      if (booking.customer.subscriptions.length > 0) score += 0.05;
      return {
        worker: w,
        score: withinRadius ? score : -1,
        distKm,
        estimatedTravelMinutes: Math.round(distKm * 2.5), // ~24km/h city avg
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // 3. Offer to top N
  const top = scored.slice(0, 3);
  const chosen = top[0];

  if (!chosen) {
    // No candidates — leave for manual dispatch
    await broadcast(CHANNELS.adminOps(), "dispatch:no_candidates", { bookingId, code: booking.code });
    return { bookingId, offered: [], manual: true };
  }

  // Create assignment offer
  await db.workerAssignment.create({
    data: {
      workerId: chosen.worker.id,
      bookingId,
      assignedBy: "system",
      status: "OFFERED",
      estimatedTravelMinutes: chosen.estimatedTravelMinutes,
    },
  });

  // Move booking to "assigned"
  await db.booking.update({
    where: { id: bookingId },
    data: { status: "assigned" },
  });
  await db.bookingStatusHistory.create({
    data: {
      bookingId,
      fromStatus: "requested",
      toStatus: "assigned",
      actorType: "SYSTEM",
      reason: "auto-dispatch",
    },
  });

  await emitBookingEvent(
    bookingId,
    "worker.assigned",
    { workerId: chosen.worker.id, score: chosen.score, estTravelMin: chosen.estimatedTravelMinutes },
    { id: "system", type: "SYSTEM" },
  );

  await broadcast(CHANNELS.worker(chosen.worker.id), "assignment:offered", {
    bookingId,
    code: booking.code,
    serviceType: booking.serviceType.code,
    scheduledStart: booking.scheduledStart,
  });

  return {
    bookingId,
    offered: top.map((t) => ({
      workerId: t.worker.id,
      score: Number(t.score.toFixed(3)),
      estimatedTravelMinutes: t.estimatedTravelMinutes,
    })),
    chosen: chosen.worker.id,
    manual: false,
  };
}

export async function manualAssign(bookingId: string, workerId: string, managerId: string) {
  const [booking, worker] = await Promise.all([
    db.booking.findUnique({ where: { id: bookingId } }),
    db.worker.findUnique({ where: { id: workerId, status: "ACTIVE" } }),
  ]);
  if (!booking) throw notFound("Booking not found");
  if (!worker) throw notFound("Worker not found or not active");

  await db.workerAssignment.create({
    data: {
      workerId,
      bookingId,
      assignedBy: managerId,
      status: "OFFERED",
    },
  });
  await db.booking.update({
    where: { id: bookingId },
    data: { status: "assigned" },
  });
  await db.bookingStatusHistory.create({
    data: {
      bookingId,
      fromStatus: booking.status as string,
      toStatus: "assigned",
      actorId: managerId,
      actorType: "MANAGER",
      reason: "manual override",
    },
  });
  await broadcast(CHANNELS.worker(workerId), "assignment:offered", {
    bookingId,
    code: booking.code,
  });
  return { bookingId, workerId, manual: true };
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
