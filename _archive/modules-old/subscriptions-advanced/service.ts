/**
 * ============================================================================
 *  Advanced Subscription Management
 *  - Add-ons + assignments (with proration)
 *  - Usage tracking + overage billing
 *  - Dunning workflow (retry attempts, grace period, suspension)
 *  - Pause scheduling (with auto-resume)
 *  - Lifecycle event log (audit trail of every state change)
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Lifecycle event helper — every state change emits one
// ---------------------------------------------------------------------------

async function logLifecycleEvent(subscriptionId: string, eventType: string, payload: Record<string, unknown> = {}, actor?: { id?: string; type?: string }) {
  await db.subscriptionLifecycleEvent.create({
    data: {
      subscriptionId,
      eventType,
      payloadJson: JSON.stringify(payload),
      actorId: actor?.id,
      actorType: actor?.type,
    },
  });
  await publish({
    eventType: `subscription.${eventType.toLowerCase()}`,
    payload: { subscriptionId, ...payload },
  });
}

// ---------------------------------------------------------------------------
//  Add-ons
// ---------------------------------------------------------------------------

export async function createAddon(input: { code: string; name: string; description?: string; priceMinor: number; billingCycle?: string }) {
  const existing = await db.subscriptionAddon.findUnique({ where: { code: input.code } });
  if (existing) throw conflict(`Addon ${input.code} already exists`);
  return db.subscriptionAddon.create({ data: input });
}

export async function assignAddon(subscriptionId: string, addonId: string, actor?: { id?: string; type?: string }) {
  const [sub, addon] = await Promise.all([
    db.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } }),
    db.subscriptionAddon.findUnique({ where: { id: addonId } }),
  ]);
  if (!sub) throw notFound("Subscription not found");
  if (!addon) throw notFound("Addon not found");

  // Proration: charge for the remaining days in the current billing period
  const now = Date.now();
  const periodEnd = sub.nextBillingDate ? sub.nextBillingDate.getTime() : now + 30 * 24 * 60 * 60 * 1000;
  const periodStart = periodEnd - 30 * 24 * 60 * 60 * 1000;
  const remainingDays = Math.max(0, (periodEnd - now) / (24 * 60 * 60 * 1000));
  const prorationMinor = addon.billingCycle === "MONTHLY"
    ? Math.round(addon.priceMinor * (remainingDays / 30))
    : addon.priceMinor;

  const assignment = await db.subscriptionAddonAssignment.create({
    data: { subscriptionId, addonId, prorationMinor },
  });

  await logLifecycleEvent(subscriptionId, "ADDON_ADDED", { addonId, addonCode: addon.code, prorationMinor }, actor);
  return assignment;
}

export async function removeAddon(subscriptionId: string, addonAssignmentId: string, actor?: { id?: string; type?: string }) {
  const assignment = await db.subscriptionAddonAssignment.findUnique({ where: { id: addonAssignmentId } });
  if (!assignment || assignment.subscriptionId !== subscriptionId) throw notFound("Addon assignment not found");
  const updated = await db.subscriptionAddonAssignment.update({
    where: { id: addonAssignmentId },
    data: { status: "REMOVED", removedAt: new Date() },
  });
  await logLifecycleEvent(subscriptionId, "ADDON_REMOVED", { addonId: assignment.addonId }, actor);
  return updated;
}

// ---------------------------------------------------------------------------
//  Usage tracking + overage billing
// ---------------------------------------------------------------------------

export async function recordUsage(subscriptionId: string, units: number) {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
  if (!sub) throw notFound("Subscription not found");
  if (sub.status !== "ACTIVE") throw badRequest("Subscription is not active");

  // Current period = current month
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Get included volume from the plan (using billingPriceMinor as a proxy for tier;
  // in production, plan would have `includedVolume` field)
  const unitsIncluded = 4; // 4 services per month on a standard plan

  const existing = await db.subscriptionUsage.findUnique({
    where: { subscriptionId_periodStart: { subscriptionId, periodStart } },
  });

  const newUnitsUsed = (existing?.unitsUsed ?? 0) + units;
  const overageUnits = Math.max(0, newUnitsUsed - unitsIncluded);
  const overageMinor = overageUnits * (sub.plan.billingPriceMinor / 4); // 25% of monthly per extra

  const upserted = await db.subscriptionUsage.upsert({
    where: { subscriptionId_periodStart: { subscriptionId, periodStart } },
    update: { unitsUsed: newUnitsUsed, overageMinor, lastUpdated: new Date() },
    create: { subscriptionId, periodStart, periodEnd, unitsUsed: newUnitsUsed, unitsIncluded, overageMinor },
  });

  return upserted;
}

// ---------------------------------------------------------------------------
//  Dunning — automated retry schedule when payment fails
//    Schedule: retry in 1d, 3d, 7d, then suspend
// ---------------------------------------------------------------------------

export async function startDunning(subscriptionId: string) {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw notFound("Subscription not found");
  if (sub.status !== "ACTIVE") throw badRequest("Subscription not active");

  const schedule = [
    { days: 1, type: "RETRY" },
    { days: 3, type: "RETRY" },
    { days: 7, type: "PAYMENT_FAILED" },
    { days: 10, type: "GRACE_PERIOD" },
    { days: 14, type: "SUSPENDED" },
  ];

  const now = Date.now();
  await db.subscriptionDunningEvent.createMany({
    data: schedule.map((s, i) => ({
      subscriptionId,
      attemptNumber: i + 1,
      type: s.type,
      scheduledAt: new Date(now + s.days * 24 * 60 * 60 * 1000),
      status: "SCHEDULED",
    })),
  });

  await logLifecycleEvent(subscriptionId, "DUNNING_STARTED", {});
  return { scheduled: schedule.length };
}

export async function resolveDunning(subscriptionId: string) {
  await db.subscriptionDunningEvent.updateMany({
    where: { subscriptionId, status: { in: ["SCHEDULED", "SENT"] } },
    data: { status: "RESOLVED", processedAt: new Date() },
  });
  await logLifecycleEvent(subscriptionId, "DUNNING_RESOLVED", {});
}

export async function processDueDunningEvents() {
  const due = await db.subscriptionDunningEvent.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    take: 100,
  });
  for (const ev of due) {
    await db.subscriptionDunningEvent.update({
      where: { id: ev.id },
      data: { status: "SENT", processedAt: new Date() },
    });
    if (ev.type === "SUSPENDED") {
      await db.subscription.update({
        where: { id: ev.subscriptionId },
        data: { status: "PAST_DUE" },
      });
      await logLifecycleEvent(ev.subscriptionId, "DUNNING_SUSPENDED", {});
    }
  }
  return { processed: due.length };
}

// ---------------------------------------------------------------------------
//  Pause scheduling — supports auto-resume
// ---------------------------------------------------------------------------

export async function schedulePause(subscriptionId: string, startDate: Date, endDate?: Date, reason?: string, autoResume = true) {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) throw notFound("Subscription not found");

  const pause = await db.subscriptionPauseSchedule.create({
    data: { subscriptionId, startDate, endDate, reason, autoResume },
  });

  // If start date is now (or past), pause immediately
  if (startDate.getTime() <= Date.now()) {
    await db.subscription.update({
      where: { id: subscriptionId },
      data: { status: "PAUSED", pausedAt: new Date() },
    });
    await logLifecycleEvent(subscriptionId, "PAUSED", { reason });
  }

  return pause;
}

export async function autoResumeExpiredPauses() {
  const now = new Date();
  const expired = await db.subscriptionPauseSchedule.findMany({
    where: {
      autoResume: true,
      endDate: { lt: now },
    },
    include: { subscription: true },
  });
  let resumed = 0;
  for (const p of expired) {
    if (p.subscription.status === "PAUSED") {
      await db.subscription.update({
        where: { id: p.subscriptionId },
        data: { status: "ACTIVE", pausedAt: null },
      });
      await logLifecycleEvent(p.subscriptionId, "RESUMED", { autoResume: true });
      resumed++;
    }
  }
  return { resumed };
}

// ---------------------------------------------------------------------------
//  Upgrade / downgrade (with proration)
// ---------------------------------------------------------------------------

export async function changePlan(subscriptionId: string, newPlanId: string, actor?: { id?: string; type?: string }) {
  const [sub, newPlan] = await Promise.all([
    db.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } }),
    db.subscriptionPlan.findUnique({ where: { id: newPlanId } }),
  ]);
  if (!sub) throw notFound("Subscription not found");
  if (!newPlan) throw notFound("New plan not found");

  const oldPrice = sub.plan.billingPriceMinor;
  const newPrice = newPlan.billingPriceMinor;
  const isUpgrade = newPrice > oldPrice;

  // Proration credit/debit
  const now = Date.now();
  const periodEnd = sub.nextBillingDate ? sub.nextBillingDate.getTime() : now + 30 * 24 * 60 * 60 * 1000;
  const remainingFraction = Math.max(0, (periodEnd - now) / (30 * 24 * 60 * 60 * 1000));
  const prorationMinor = Math.round((newPrice - oldPrice) * remainingFraction);

  const updated = await db.subscription.update({
    where: { id: subscriptionId },
    data: { planId: newPlanId },
    include: { plan: true },
  });

  await logLifecycleEvent(
    subscriptionId,
    isUpgrade ? "UPGRADED" : "DOWNGRADED",
    { oldPlanId: sub.planId, newPlanId, oldPrice, newPrice, prorationMinor },
    actor,
  );

  return { subscription: updated, prorationMinor, isUpgrade };
}
