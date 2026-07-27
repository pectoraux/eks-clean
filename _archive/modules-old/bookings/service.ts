/**
 * Booking domain service — lifecycle transitions, validation, status history.
 */
import { db } from "@/lib/db";
import { BOOKING_STATUS_FLOW, type BookingStatus } from "@/lib/types";
import { emitBookingEvent } from "@/lib/events/bus";
import { broadcast, CHANNELS } from "@/lib/realtime";
import { HttpError, badRequest, conflict, notFound } from "@/lib/utils/api";

function nextCode(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 900000) + 100000;
  return `EKS-${year}-${rand}`;
}

export interface CreateBookingInput {
  customerId: string;
  serviceTypeId: string;
  addressId: string;
  householdProfileId?: string;
  scheduledStart: string;
  scheduledEnd: string;
  workerCount?: number;
  notes?: string;
  photoUrls?: string[];
  source?: string;
}

export async function createBooking(input: CreateBookingInput) {
  const [customer, service, address] = await Promise.all([
    db.customer.findUnique({ where: { id: input.customerId } }),
    db.serviceType.findUnique({ where: { id: input.serviceTypeId } }),
    db.address.findFirst({ where: { id: input.addressId, customerId: input.customerId } }),
  ]);
  if (!customer) throw notFound("Customer not found");
  if (!service) throw notFound("Service type not found");
  if (!address) throw badRequest("Address does not belong to customer");

  const start = new Date(input.scheduledStart);
  const end = new Date(input.scheduledEnd);
  if (end <= start) throw badRequest("scheduledEnd must be after scheduledStart");

  const hours = (end.getTime() - start.getTime()) / 3_600_000;
  const priceMinor = Math.max(1, Math.round(service.basePriceMinor * hours));
  const totalMinor = priceMinor;

  const booking = await db.booking.create({
    data: {
      code: nextCode(),
      customerId: input.customerId,
      serviceTypeId: input.serviceTypeId,
      addressId: input.addressId,
      householdProfileId: input.householdProfileId,
      status: "requested",
      scheduledStart: start,
      scheduledEnd: end,
      workerCount: input.workerCount ?? 1,
      notes: input.notes,
      photoUrls: input.photoUrls ? JSON.stringify(input.photoUrls) : null,
      priceMinor,
      totalMinor,
      currency: "GHS",
      source: input.source ?? "WEB",
    },
    include: { serviceType: true, address: true, customer: true },
  });

  await db.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      toStatus: "requested",
      actorType: "CUSTOMER",
    },
  });

  await emitBookingEvent(
    booking.id,
    "booking.created",
    { code: booking.code, serviceType: service.code, customerId: input.customerId },
    { id: input.customerId, type: "CUSTOMER" },
  );

  await broadcast(CHANNELS.adminOps(), "booking:created", { id: booking.id, code: booking.code });

  return booking;
}

export async function transitionStatus(
  bookingId: string,
  toStatus: BookingStatus,
  actor: { id: string; type: string },
  reason?: string,
) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw notFound("Booking not found");
  const fromStatus = booking.status as BookingStatus;
  const allowed = BOOKING_STATUS_FLOW[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw conflict(`Cannot transition from ${fromStatus} to ${toStatus}`);
  }

  const update: Record<string, unknown> = { status: toStatus };
  if (toStatus === "in_progress") update.actualStart = new Date();
  if (toStatus === "completed") update.actualEnd = new Date();
  if (toStatus === "cancelled") update.cancellationReason = reason;
  if (toStatus === "disputed") update.disputeReason = reason;

  const updated = await db.booking.update({
    where: { id: bookingId },
    data: update,
  });

  await db.bookingStatusHistory.create({
    data: {
      bookingId,
      fromStatus,
      toStatus,
      reason,
      actorId: actor.id,
      actorType: actor.type,
    },
  });

  await emitBookingEvent(
    bookingId,
    "booking.status_changed",
    { from: fromStatus, to: toStatus, reason },
    actor,
  );

  await Promise.all([
    broadcast(CHANNELS.booking(bookingId), "booking:status", { from: fromStatus, to: toStatus }),
    broadcast(CHANNELS.customer(booking.customerId), "booking:status", { code: booking.code, to: toStatus }),
  ]);

  return updated;
}

export async function listBookings(filter: {
  customerId?: string;
  status?: string;
  serviceTypeId?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (filter.customerId) where.customerId = filter.customerId;
  if (filter.status) where.status = filter.status;
  if (filter.serviceTypeId) where.serviceTypeId = filter.serviceTypeId;

  const [items, total] = await Promise.all([
    db.booking.findMany({
      where,
      include: {
        serviceType: true,
        address: true,
        customer: { include: { user: true } },
        assignments: { include: { worker: { include: { user: true } } } },
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { scheduledStart: "desc" },
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
    }),
    db.booking.count({ where }),
  ]);

  return { items, total };
}
