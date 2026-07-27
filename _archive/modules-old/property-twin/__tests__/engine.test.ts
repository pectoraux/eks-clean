/**
 * Property Digital Twin — pure-logic unit tests
 *  - Next cleaning recommendation, cleanliness score, timeline logic
 */
import { describe, it, expect } from "bun:test";

// Mirror of recordCleaning next-cleaning logic
function computeNextCleaningDate(lastCleanedAt: Date, avgQuality: number): Date {
  const nextRecDays = avgQuality < 70 ? 7 : 14;
  return new Date(lastCleanedAt.getTime() + nextRecDays * 24 * 60 * 60 * 1000);
}

// Mirror of cleanliness score averaging
function computeCleanlinessScore(qualities: number[]): number {
  if (qualities.length === 0) return 80;
  return qualities.reduce((s, q) => s + q, 0) / qualities.length;
}

describe("Property Digital Twin", () => {
  it("recommends sooner cleaning when quality is low", () => {
    const last = new Date("2026-07-01");
    const next = computeNextCleaningDate(last, 65); // < 70 → 7 days
    expect(next.toISOString().slice(0, 10)).toBe("2026-07-08");
  });

  it("recommends standard interval when quality is good", () => {
    const last = new Date("2026-07-01");
    const next = computeNextCleaningDate(last, 85); // >= 70 → 14 days
    expect(next.toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  it("computes average cleanliness from history", () => {
    expect(computeCleanlinessScore([80, 90, 70])).toBe(80);
    expect(computeCleanlinessScore([])).toBe(80);
    expect(computeCleanlinessScore([100])).toBe(100);
  });
});
