/**
 * Payment service — thin orchestration layer over PaymentGateway.
 * CRITICAL: This file MUST NOT implement payment logic. It only:
 *   - Calls PaymentGateway methods
 *   - Persists Payswap references to the DB
 *   - Emits domain events for downstream handlers
 *   - Reconciles webhook events into our DB
 */
import { db } from "@/lib/db";
import { getPaymentGateway } from "@/lib/payment/payswap-gateway";
import { publish } from "@/lib/events/bus";
import { notFound } from "@/lib/utils/api";

const gateway = getPaymentGateway();

export async function ensureCustomerForUser(userId: string, email: string, name: string) {
  const customer = await db.customer.findUnique({ where: { userId } });
  if (!customer) throw notFound("Customer not found");
  if (customer.payswapCustomerId) return customer;

  const ps = await gateway.createCustomer({
    email,
    name,
    metadata: { internalId: customer.id },
  });
  return db.customer.update({
    where: { id: customer.id },
    data: { payswapCustomerId: ps.payswapCustomerId },
  });
}

export async function createPaymentIntentForBooking(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { customer: { include: { user: true } } },
  });
  if (!booking) throw notFound("Booking not found");

  await ensureCustomerForUser(
    booking.customer.userId,
    booking.customer.user.email,
    booking.customer.user.fullName,
  );

  const pi = await gateway.createPaymentIntent({
    customerId: booking.customer.payswapCustomerId ?? undefined,
    amountMinor: booking.totalMinor,
    currency: booking.currency,
    description: `Eks-Clean booking ${booking.code}`,
    bookingId,
    metadata: { booking_code: booking.code, customer_id: booking.customerId },
  });

  const stored = await db.paymentIntent.create({
    data: {
      bookingId,
      customerId: booking.customerId,
      payswapPaymentIntentId: pi.payswapPaymentIntentId,
      amountMinor: booking.totalMinor,
      currency: booking.currency,
      status: pi.status,
      description: `Booking ${booking.code}`,
    },
  });

  await publish({
    eventType: "payment.intent_created",
    bookingId,
    payload: { id: stored.id, payswapId: pi.payswapPaymentIntentId, amount: booking.totalMinor },
  });

  return { id: stored.id, clientSecret: pi.clientSecret, status: pi.status };
}

export async function capturePaymentIntent(paymentIntentId: string) {
  const row = await db.paymentIntent.findUnique({ where: { id: paymentIntentId } });
  if (!row) throw notFound("Payment intent not found");
  const result = await gateway.capturePayment(row.payswapPaymentIntentId!);
  const updated = await db.paymentIntent.update({
    where: { id: paymentIntentId },
    data: { status: result.status, capturedAt: new Date() },
  });
  await publish({
    eventType: "payment.captured",
    bookingId: row.bookingId ?? undefined,
    payload: { id: row.id, payswapId: row.payswapPaymentIntentId, status: result.status },
  });
  return updated;
}

export async function refundPaymentIntent(paymentIntentId: string, amountMinor?: number, reason?: string) {
  const row = await db.paymentIntent.findUnique({ where: { id: paymentIntentId } });
  if (!row) throw notFound("Payment intent not found");
  const r = await gateway.refundPayment({
    paymentIntentId: row.payswapPaymentIntentId!,
    amountMinor,
    reason,
  });
  await db.paymentIntent.update({
    where: { id: paymentIntentId },
    data: { refundedAmountMinor: { increment: r.amountMinor } },
  });
  await publish({
    eventType: "payment.refunded",
    bookingId: row.bookingId ?? undefined,
    payload: { id: row.id, refundId: r.payswapRefundId, amount: r.amountMinor },
  });
  return r;
}

export async function transferPayoutToWorker(workerId: string, amountMinor: number) {
  const worker = await db.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw notFound("Worker not found");
  if (!worker.payswapAccountId) {
    throw new Error("Worker has no connected account");
  }
  const t = await gateway.transferToWorker({
    amountMinor,
    currency: "GHS",
    destinationAccountId: worker.payswapAccountId,
    transferGroup: `payout_${workerId}_${Date.now()}`,
    metadata: { workerId },
  });
  const payout = await db.payout.create({
    data: {
      workerId,
      periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(),
      grossAmountMinor: amountMinor,
      platformFeeMinor: 0,
      netAmountMinor: amountMinor,
      payswapTransferId: t.payswapTransferId,
      status: "PAID",
    },
  });
  return { payout, transfer: t };
}

export async function handleWebhookEvent(rawBody: string, signature: string) {
  const verified = await gateway.verifyWebhook(rawBody, signature);
  if (!verified.valid) {
    return { ok: false, reason: "invalid_signature" };
  }
  // Idempotency: store the event id
  const existing = await db.paymentWebhookEvent.findUnique({
    where: { payswapEventId: verified.event.id },
  });
  if (existing) {
    return { ok: true, duplicate: true };
  }
  await db.paymentWebhookEvent.create({
    data: {
      payswapEventId: verified.event.id,
      type: verified.event.type,
      payloadJson: rawBody,
      signature,
      verified: true,
      processedAt: new Date(),
    },
  });

  // Route to handlers based on event type
  switch (verified.event.type) {
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.captured":
    case "refund.created":
    case "refund.succeeded":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "subscription.created":
    case "subscription.updated":
    case "subscription.deleted":
      await publish({
        eventType: `payswap.${verified.event.type}`,
        payload: verified.event as unknown as Record<string, unknown>,
      });
      break;
    default:
      // Unknown but stored for replay
      break;
  }
  return { ok: true, duplicate: false, type: verified.event.type };
}
