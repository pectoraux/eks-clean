/**
 * Workforce Management — pure-logic unit tests
 *  - Performance score computation, trend detection, overlap detection
 */

import { describe, it, expect } from "bun:test";

// Mirror of computePerformanceScore logic
function computeOverallScore(scores: {
  punctuality: number; quality: number; productivity: number; customer: number; team: number;
}): number {
  return (
    0.25 * scores.punctuality +
    0.30 * scores.quality +
    0.20 * scores.productivity +
    0.15 * scores.customer +
    0.10 * scores.team
  );
}

// Mirror of trend detection
function detectTrend(current: number, previous: number | null, threshold = 3): "UP" | "DOWN" | "STABLE" {
  if (previous === null) return "STABLE";
  if (current > previous + threshold) return "UP";
  if (current < previous - threshold) return "DOWN";
  return "STABLE";
}

// Mirror of punctuality score
function punctualityScore(present: number, late: number, total: number): number {
  if (total === 0) return 80; // default
  return ((present + late * 0.5) / total) * 100;
}

// Mirror of productivity score
function productivityScore(completed: number, total: number): number {
  if (total === 0) return 75;
  return (completed / total) * 100;
}

// Mirror of time-off overlap check
function hasOverlap(existingStart: Date, existingEnd: Date, newStart: Date, newEnd: Date): boolean {
  return existingStart <= newEnd && existingEnd >= newStart;
}

describe("Workforce — performance scoring", () => {
  it("weights the 5 factors correctly", () => {
    const score = computeOverallScore({
      punctuality: 100, quality: 100, productivity: 100, customer: 100, team: 100,
    });
    expect(score).toBe(100);
  });

  it("penalizes low punctuality less than low quality", () => {
    const lowPunctuality = computeOverallScore({
      punctuality: 0, quality: 100, productivity: 100, customer: 100, team: 100,
    });
    const lowQuality = computeOverallScore({
      punctuality: 100, quality: 0, productivity: 100, customer: 100, team: 100,
    });
    expect(lowPunctuality).toBeGreaterThan(lowQuality); // 25% weight < 30% weight
  });

  it("detects upward trend", () => {
    expect(detectTrend(85, 80)).toBe("UP");
    expect(detectTrend(85, 82)).toBe("STABLE"); // within threshold
  });

  it("detects downward trend", () => {
    expect(detectTrend(75, 80)).toBe("DOWN");
    expect(detectTrend(78, 80)).toBe("STABLE");
  });

  it("returns stable when no previous score", () => {
    expect(detectTrend(85, null)).toBe("STABLE");
  });

  it("computes punctuality score with late penalty", () => {
    expect(punctualityScore(8, 2, 10)).toBe(90); // (8 + 1) / 10 * 100
    expect(punctualityScore(10, 0, 10)).toBe(100);
    expect(punctualityScore(0, 0, 0)).toBe(80); // default
  });

  it("computes productivity score", () => {
    expect(productivityScore(8, 10)).toBe(80);
    expect(productivityScore(10, 10)).toBe(100);
    expect(productivityScore(0, 0)).toBe(75); // default
  });
});

describe("Workforce — time-off overlap", () => {
  it("detects overlapping date ranges", () => {
    const existing = { start: new Date("2026-07-10"), end: new Date("2026-07-15") };
    expect(hasOverlap(existing.start, existing.end, new Date("2026-07-12"), new Date("2026-07-18"))).toBe(true);
    expect(hasOverlap(existing.start, existing.end, new Date("2026-07-15"), new Date("2026-07-20"))).toBe(true); // boundary
    expect(hasOverlap(existing.start, existing.end, new Date("2026-07-16"), new Date("2026-07-20"))).toBe(false);
    expect(hasOverlap(existing.start, existing.end, new Date("2026-07-05"), new Date("2026-07-09"))).toBe(false);
    expect(hasOverlap(existing.start, existing.end, new Date("2026-07-05"), new Date("2026-07-12"))).toBe(true); // overlaps start
  });
});
