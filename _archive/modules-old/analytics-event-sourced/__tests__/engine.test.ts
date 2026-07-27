/**
 * Event-Sourced Analytics — pure-logic unit tests
 *  - Version monotonicity, projection builders, accuracy scoring
 */

import { describe, it, expect } from "bun:test";

// Mirror of recordEvent version logic
function nextVersion(lastVersion: number | null): number {
  return (lastVersion ?? 0) + 1;
}

// Mirror of monthlyRevenueProjection.build
function buildMonthlyRevenue(events: Array<{ occurredAt: Date; payloadJson: string }>): Map<string, { totalMinor: number; count: number }> {
  const byMonth = new Map<string, { totalMinor: number; count: number }>();
  for (const e of events) {
    const payload = JSON.parse(e.payloadJson) as { amountMinor?: number };
    const month = e.occurredAt.toISOString().slice(0, 7);
    const existing = byMonth.get(month) ?? { totalMinor: 0, count: 0 };
    existing.totalMinor += payload.amountMinor ?? 0;
    existing.count++;
    byMonth.set(month, existing);
  }
  return byMonth;
}

// Mirror of workerCompletionProjection.build
function buildWorkerCompletion(events: Array<{ payloadJson: string }>): Map<string, number> {
  const byWorker = new Map<string, number>();
  for (const e of events) {
    const payload = JSON.parse(e.payloadJson) as { workerId?: string };
    if (payload.workerId) {
      byWorker.set(payload.workerId, (byWorker.get(payload.workerId) ?? 0) + 1);
    }
  }
  return byWorker;
}

// Mirror of resolvePrediction accuracy
function computeAccuracy(predicted: number, actual: number): number {
  if (actual === 0) return 0;
  const error = Math.abs(actual - predicted);
  return Math.max(0, 1 - error / Math.abs(actual));
}

describe("Event-Sourced Analytics — versioning", () => {
  it("starts at version 1 for new aggregates", () => {
    expect(nextVersion(null)).toBe(1);
  });

  it("increments version monotonically", () => {
    expect(nextVersion(1)).toBe(2);
    expect(nextVersion(5)).toBe(6);
    expect(nextVersion(100)).toBe(101);
  });
});

describe("Event-Sourced Analytics — monthly revenue projection", () => {
  it("aggregates revenue by month", () => {
    const events = [
      { occurredAt: new Date("2026-07-01"), payloadJson: JSON.stringify({ amountMinor: 10000 }) },
      { occurredAt: new Date("2026-07-15"), payloadJson: JSON.stringify({ amountMinor: 20000 }) },
      { occurredAt: new Date("2026-08-01"), payloadJson: JSON.stringify({ amountMinor: 5000 }) },
    ];
    const result = buildMonthlyRevenue(events);
    expect(result.get("2026-07")?.totalMinor).toBe(30000);
    expect(result.get("2026-07")?.count).toBe(2);
    expect(result.get("2026-08")?.totalMinor).toBe(5000);
    expect(result.get("2026-08")?.count).toBe(1);
  });

  it("handles missing amountMinor", () => {
    const events = [
      { occurredAt: new Date("2026-07-01"), payloadJson: JSON.stringify({}) },
    ];
    const result = buildMonthlyRevenue(events);
    expect(result.get("2026-07")?.totalMinor).toBe(0);
  });
});

describe("Event-Sourced Analytics — worker completion projection", () => {
  it("counts completed jobs per worker", () => {
    const events = [
      { payloadJson: JSON.stringify({ workerId: "w1" }) },
      { payloadJson: JSON.stringify({ workerId: "w1" }) },
      { payloadJson: JSON.stringify({ workerId: "w2" }) },
      { payloadJson: JSON.stringify({}) }, // no workerId
    ];
    const result = buildWorkerCompletion(events);
    expect(result.get("w1")).toBe(2);
    expect(result.get("w2")).toBe(1);
    expect(result.size).toBe(2);
  });
});

describe("AI-Ready — prediction accuracy", () => {
  it("scores perfect accuracy when actual equals predicted", () => {
    expect(computeAccuracy(100, 100)).toBe(1);
  });

  it("scores zero accuracy when actual is zero", () => {
    expect(computeAccuracy(100, 0)).toBe(0);
  });

  it("scores partial accuracy based on relative error", () => {
    // predicted 100, actual 80 → error 20, accuracy = 1 - 20/80 = 0.75
    expect(computeAccuracy(100, 80)).toBe(0.75);
    // predicted 100, actual 150 → error 50, accuracy = 1 - 50/150 ≈ 0.667
    expect(computeAccuracy(100, 150)).toBeCloseTo(0.667, 2);
  });

  it("clamps negative accuracy to zero", () => {
    // predicted 100, actual 10 → error 90, accuracy = 1 - 90/10 = -8 → clamped to 0
    expect(computeAccuracy(100, 10)).toBe(0);
  });
});
