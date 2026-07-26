// Create a Payswap Checkout Session for a booking
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, notFound } from "@/lib/utils/api";
import { getPaymentGateway } from "@/lib/payment/payswap-gateway";
import { ensureCustomerForUser } from "@/lib/modules/payments/service";

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "bookings:read");
    const url = new URL(req.url);
    const bookingId = url.searchParams.get("bookingId");
    if (!bookingId) throw new Error("bookingId required");
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

    const origin = new URL(req.url).origin;
    const gateway = getPaymentGateway();
    const cs = await gateway.createCheckoutSession({
      customerId: booking.customer.payswapCustomerId ?? undefined,
      amountMinor: booking.totalMinor,
      currency: booking.currency,
      description: `Eks-Clean booking ${booking.code}`,
      bookingId,
      successUrl: `${origin}/?pay=success&booking=${booking.code}`,
      cancelUrl: `${origin}/?pay=cancel&booking=${booking.code}`,
      metadata: { booking_code: booking.code },
    });

    await db.paymentIntent.create({
      data: {
        bookingId,
        customerId: booking.customerId,
        payswapPaymentIntentId: cs.payswapCheckoutSessionId,
        payswapCheckoutSessionId: cs.payswapCheckoutSessionId,
        amountMinor: booking.totalMinor,
        currency: booking.currency,
        status: "requires_confirmation",
        description: `Checkout for ${booking.code}`,
      },
    });

    return { url: cs.url, sessionId: cs.payswapCheckoutSessionId };
  });
}
