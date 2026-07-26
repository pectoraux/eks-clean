// Revenue analytics — last N days grouped by day
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, unauthorized } from "@/lib/utils/api";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days") ?? 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Group payments by day (sqlite: use strftime)
    const rows = await db.paymentIntent.findMany({
      where: { status: "succeeded", capturedAt: { gte: since } },
      select: { amountMinor: true, capturedAt: true },
    });
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const day = (r.capturedAt ?? new Date()).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + r.amountMinor);
    }
    const series = Array.from(byDay.entries())
      .map(([date, amount]) => ({ date, amountMinor: amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalMinor = rows.reduce((sum, r) => sum + r.amountMinor, 0);
    return { days, totalMinor, series };
  });
}
