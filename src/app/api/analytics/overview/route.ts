// Analytics — overview, revenue, utilization
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, unauthorized } from "@/lib/utils/api";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();

    const [
      totalCustomers,
      totalWorkers,
      totalBookings,
      activeSubscriptions,
      completedBookings,
      cancelledBookings,
      disputedBookings,
      totalRevenueAgg,
      avgRatingAgg,
      recentBookings,
    ] = await Promise.all([
      db.customer.count({ where: { deletedAt: null } }),
      db.worker.count({ where: { status: "ACTIVE", deletedAt: null } }),
      db.booking.count({ where: { deletedAt: null } }),
      db.subscription.count({ where: { status: "ACTIVE", deletedAt: null } }),
      db.booking.count({ where: { status: { in: ["completed", "rated"] } } }),
      db.booking.count({ where: { status: "cancelled" } }),
      db.booking.count({ where: { status: "disputed" } }),
      db.paymentIntent.aggregate({
        where: { status: "succeeded" },
        _sum: { amountMinor: true },
      }),
      db.rating.aggregate({ _avg: { overall: true }, _count: true }),
      db.booking.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { serviceType: true, customer: { include: { user: true } } },
      }),
    ]);

    const completionRate = totalBookings > 0 ? completedBookings / totalBookings : 0;
    const cancellationRate = totalBookings > 0 ? cancelledBookings / totalBookings : 0;

    return {
      totals: {
        customers: totalCustomers,
        workers: totalWorkers,
        bookings: totalBookings,
        activeSubscriptions,
        completedBookings,
        cancelledBookings,
        disputedBookings,
        revenueMinor: totalRevenueAgg._sum.amountMinor ?? 0,
        avgRating: avgRatingAgg._avg.overall ?? 0,
        totalRatings: avgRatingAgg._count,
        completionRate,
        cancellationRate,
      },
      recentBookings,
    };
  });
}
