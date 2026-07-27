/**
 * Advanced Subscriptions — pure-logic unit tests
 *  - Proration calculation, overage billing, dunning schedule
 */

import { describe, it, expect } from "bun:test";

// Mirror of assignAddon proration logic
function computeProration(addonPriceMinor: number, billingCycle: string, daysRemaining: number, totalDays = 30): number {
  if (billingCycle === "MONTHLY") {
    return Math.round(addonPriceMinor * (daysRemaining / totalDays));
  }
  return addonPriceMinor; // ONE_TIME or PER_USE
}

// Mirror of recordUsage overage calculation
function computeOverage(unitsUsed: number, unitsIncluded: number, perUnitMinor: number): number {
  const overageUnits = Math.max(0, unitsUsed - unitsIncluded);
  return overageUnits * perUnitMinor;
}

// Mirror of changePlan proration
function computePlanChangeProration(oldPrice: number, newPrice: number, remainingFraction: number): number {
  return Math.round((newPrice - oldPrice) * remainingFraction);
}

// Mirror of startDunning schedule
function buildDunningSchedule(now: number): Array<{ days: number; type: string }> {
  return [
    { days: 1, type: "RETRY" },
    { days: 3, type: "RETRY" },
    { days: 7, type: "PAYMENT_FAILED" },
    { days: 10, type: "GRACE_PERIOD" },
    { days: 14, type: "SUSPENDED" },
  ];
}

describe("Advanced Subscriptions — proration & dunning", () => {
  it("prorates monthly addons for remaining days", () => {
    // 15 days remaining in a 30-day period, ₵100/month addon
    expect(computeProration(10000, "MONTHLY", 15, 30)).toBe(5000);
    expect(computeProration(10000, "MONTHLY", 30, 30)).toBe(10000);
    expect(computeProration(10000, "MONTHLY", 0, 30)).toBe(0);
  });

  it("charges full price for one-time addons", () => {
    expect(computeProration(5000, "ONE_TIME", 15)).toBe(5000);
    expect(computeProration(5000, "ONE_TIME", 0)).toBe(5000);
  });

  it("charges per-use addons at full price", () => {
    expect(computeProration(2500, "PER_USE", 15)).toBe(2500);
  });

  it("computes overage when usage exceeds included", () => {
    expect(computeOverage(10, 4, 5000)).toBe(30000); // 6 extra × 5000
    expect(computeOverage(4, 4, 5000)).toBe(0); // exactly at limit
    expect(computeOverage(3, 4, 5000)).toBe(0); // under limit
    expect(computeOverage(0, 4, 5000)).toBe(0);
  });

  it("computes plan change proration (upgrade)", () => {
    // Old ₵100, new ₵200, half period remaining → proration = (200-100) × 0.5 = 50
    expect(computePlanChangeProration(10000, 20000, 0.5)).toBe(5000);
  });

  it("computes plan change proration (downgrade, negative)", () => {
    // Old ₵200, new ₵100, half period remaining → proration = (100-200) × 0.5 = -50 (credit)
    expect(computePlanChangeProration(20000, 10000, 0.5)).toBe(-5000);
  });

  it("zero proration when no time remaining", () => {
    expect(computePlanChangeProration(10000, 20000, 0)).toBe(0);
  });

  it("builds a 5-step dunning schedule", () => {
    const schedule = buildDunningSchedule(Date.now());
    expect(schedule).toHaveLength(5);
    expect(schedule[0].type).toBe("RETRY");
    expect(schedule[4].type).toBe("SUSPENDED");
    expect(schedule.map(s => s.days)).toEqual([1, 3, 7, 10, 14]);
  });
});
