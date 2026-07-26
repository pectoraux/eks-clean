/**
 * ============================================================================
 *  Advanced Analytics — saved views, scheduled reports, snapshots, cohorts
 * ============================================================================
 */

import { db } from "@/lib/db";
import { notFound } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Saved dashboard views
// ---------------------------------------------------------------------------

export async function saveView(input: {
  name: string;
  description?: string;
  ownerId?: string;
  scope?: string;
  config: unknown;
  isPublic?: boolean;
}) {
  return db.analyticsView.create({
    data: {
      name: input.name,
      description: input.description,
      ownerId: input.ownerId,
      scope: input.scope ?? "USER",
      configJson: JSON.stringify(input.config),
      isPublic: input.isPublic ?? false,
    },
  });
}

export async function listViews(ownerId?: string, includePublic = true) {
  return db.analyticsView.findMany({
    where: {
      OR: [
        ...(ownerId ? [{ ownerId }] : []),
        ...(includePublic ? [{ isPublic: true }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
//  Scheduled reports — compute nextRunAt based on schedule
// ---------------------------------------------------------------------------

export async function scheduleReport(input: {
  name: string;
  description?: string;
  schedule: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
  recipients: string[];
  config: unknown;
  format?: string;
  createdBy?: string;
}) {
  const now = new Date();
  const nextRunAt = computeNextRun(now, input.schedule);
  return db.analyticsReport.create({
    data: {
      name: input.name,
      description: input.description,
      schedule: input.schedule,
      recipientsJson: JSON.stringify(input.recipients),
      configJson: JSON.stringify(input.config),
      format: input.format ?? "PDF",
      nextRunAt,
      createdBy: input.createdBy,
      isActive: true,
    },
  });
}

function computeNextRun(from: Date, schedule: string): Date {
  switch (schedule) {
    case "DAILY": return new Date(from.getTime() + 24 * 60 * 60 * 1000);
    case "WEEKLY": return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "MONTHLY": return new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
    case "QUARTERLY": return new Date(from.getTime() + 90 * 24 * 60 * 60 * 1000);
    default: return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }
}

export async function dueReports() {
  return db.analyticsReport.findMany({
    where: { isActive: true, nextRunAt: { lt: new Date() } },
  });
}

export async function markReportRun(reportId: string, schedule: string) {
  const report = await db.analyticsReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("Report not found");
  return db.analyticsReport.update({
    where: { id: reportId },
    data: {
      lastRunAt: new Date(),
      nextRunAt: computeNextRun(new Date(), schedule),
    },
  });
}

// ---------------------------------------------------------------------------
//  Snapshots — periodic captures for trend lines
// ---------------------------------------------------------------------------

export async function captureSnapshot(metricKey: string, period: string, periodType: string, value: number, dimensions?: Record<string, string>) {
  return db.analyticsSnapshot.upsert({
    where: { metricKey_period: { metricKey, period } },
    update: { value, dimensionsJson: dimensions ? JSON.stringify(dimensions) : null, capturedAt: new Date() },
    create: { metricKey, period, periodType, value, dimensionsJson: dimensions ? JSON.stringify(dimensions) : null },
  });
}

export async function snapshotSeries(metricKey: string, lastN = 30) {
  return db.analyticsSnapshot.findMany({
    where: { metricKey },
    orderBy: { period: "desc" },
    take: lastN,
  });
}

// ---------------------------------------------------------------------------
//  Cohort analysis — retention by signup month
// ============================================================================

export interface CohortRow {
  cohort: string; // YYYY-MM
  size: number;
  retention: number[]; // % retained at month 0, 1, 2, ...
}

export async function cohortRetention(monthsBack = 6): Promise<CohortRow[]> {
  const customers = await db.customer.findMany({
    where: { deletedAt: null, createdAt: { gte: new Date(Date.now() - monthsBack * 30 * 24 * 60 * 60 * 1000) } },
    include: { bookings: { where: { deletedAt: null }, select: { scheduledStart: true } } },
  });

  const cohorts = new Map<string, Date[]>();
  for (const c of customers) {
    const cohort = c.createdAt.toISOString().slice(0, 7);
    if (!cohorts.has(cohort)) cohorts.set(cohort, []);
    cohorts.get(cohort)!.push(c.createdAt);
    // also track first booking month
    if (c.bookings.length > 0) {
      const firstBooking = c.bookings.sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())[0];
      cohorts.get(cohort)!.push(firstBooking.scheduledStart);
    }
  }

  const rows: CohortRow[] = [];
  for (const [cohort, dates] of cohorts.entries()) {
    const cohortSize = customers.filter((c) => c.createdAt.toISOString().slice(0, 7) === cohort).length;
    const retention: number[] = [];
    for (let m = 0; m < monthsBack; m++) {
      const retained = customers.filter((c) => {
        if (c.createdAt.toISOString().slice(0, 7) !== cohort) return false;
        const monthAfter = new Date(c.createdAt.getTime() + m * 30 * 24 * 60 * 60 * 1000);
        return c.bookings.some((b) => b.scheduledStart >= monthAfter);
      }).length;
      retention.push(cohortSize > 0 ? retained / cohortSize : 0);
    }
    rows.push({ cohort, size: cohortSize, retention });
  }
  return rows.sort((a, b) => a.cohort.localeCompare(b.cohort));
}

// ---------------------------------------------------------------------------
//  Customer Lifetime Value (CLV) — simple historical CLV
// ---------------------------------------------------------------------------

export async function customerLifetimeValue(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      bookings: { where: { deletedAt: null, status: { in: ["completed", "rated"] } } },
      subscriptions: { where: { status: "ACTIVE" } },
    },
  });
  if (!customer) throw notFound("Customer not found");

  const totalSpend = customer.bookings.reduce((s, b) => s + b.totalMinor, 0);
  const avgBooking = customer.bookings.length > 0 ? totalSpend / customer.bookings.length : 0;
  const monthsActive = Math.max(1, (Date.now() - customer.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000));
  const monthlyRunRate = totalSpend / monthsActive;
  const subscriptionValueMonthly = customer.subscriptions.length * 18000; // rough estimate
  const projectedAnnual = (monthlyRunRate + subscriptionValueMonthly) * 12;

  return {
    totalSpendMinor: totalSpend,
    avgBookingMinor: avgBooking,
    monthsActive: Math.round(monthsActive),
    monthlyRunRateMinor: monthlyRunRate,
    subscriptionValueMonthlyMinor: subscriptionValueMonthly,
    projectedAnnualLtvMinor: projectedAnnual,
    bookingCount: customer.bookings.length,
  };
}

// ---------------------------------------------------------------------------
//  Churn risk — pull from health scores
// ---------------------------------------------------------------------------

export async function churnRiskList() {
  const atRisk = await db.customerHealthScore.findMany({
    where: { tier: "RISK" },
    include: { customer: { include: { user: true } } },
    orderBy: { score: "asc" },
    take: 50,
  });
  return atRisk;
}
