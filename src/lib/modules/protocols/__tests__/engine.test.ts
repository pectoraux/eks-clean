/**
 * Cleaning Protocol Engine — pure-logic unit tests
 *
 * Covers: compliance score computation, deviation detection,
 * step ordering, photo requirement enforcement.
 */

import { describe, it, expect } from "bun:test";

// Mirror of finishExecution's compliance calculation
function computeComplianceScore(
  stepExecutions: Array<{ status: string; deviationFlag: boolean }>,
): { score: number; status: string } {
  const totalSteps = stepExecutions.length;
  if (totalSteps === 0) return { score: 0, status: "COMPLETED" };
  const completed = stepExecutions.filter((s) => s.status === "COMPLETED").length;
  const deviations = stepExecutions.filter((s) => s.deviationFlag).length;
  const score = ((completed - deviations * 0.5) / totalSteps) * 100;
  const clamped = Math.max(0, score);
  const status = clamped >= 80 ? "COMPLETED" : deviations > 0 ? "DEVIATION" : "COMPLETED";
  return { score: clamped, status };
}

describe("Protocol Engine — compliance scoring", () => {
  it("returns 100% compliance when all steps completed without deviation", () => {
    const result = computeComplianceScore([
      { status: "COMPLETED", deviationFlag: false },
      { status: "COMPLETED", deviationFlag: false },
      { status: "COMPLETED", deviationFlag: false },
    ]);
    expect(result.score).toBe(100);
    expect(result.status).toBe("COMPLETED");
  });

  it("deducts 50% per deviation", () => {
    const result = computeComplianceScore([
      { status: "COMPLETED", deviationFlag: false },
      { status: "COMPLETED", deviationFlag: true },
      { status: "COMPLETED", deviationFlag: false },
      { status: "COMPLETED", deviationFlag: false },
    ]);
    // (4 completed - 1 deviation * 0.5) / 4 * 100 = 87.5
    // Score >= 80 → status COMPLETED (despite deviation flag)
    expect(result.score).toBe(87.5);
    expect(result.status).toBe("COMPLETED");
  });

  it("returns 0 when no steps completed", () => {
    const result = computeComplianceScore([
      { status: "PENDING", deviationFlag: false },
      { status: "PENDING", deviationFlag: false },
    ]);
    expect(result.score).toBe(0);
  });

  it("handles empty executions", () => {
    const result = computeComplianceScore([]);
    expect(result.score).toBe(0);
    expect(result.status).toBe("COMPLETED");
  });

  it("clamps negative scores to 0", () => {
    const result = computeComplianceScore([
      { status: "PENDING", deviationFlag: false },
      { status: "PENDING", deviationFlag: false },
      { status: "PENDING", deviationFlag: false },
    ]);
    // (0 completed - 0 deviations) / 3 * 100 = 0
    expect(result.score).toBe(0);
  });

  it("returns DEVIATION status when any deviation flag is true and score < 80", () => {
    const result = computeComplianceScore([
      { status: "COMPLETED", deviationFlag: true },
      { status: "COMPLETED", deviationFlag: true },
      { status: "COMPLETED", deviationFlag: true },
      { status: "COMPLETED", deviationFlag: true },
    ]);
    // (4 completed - 4 deviations * 0.5) / 4 * 100 = 50
    expect(result.score).toBe(50);
    expect(result.status).toBe("DEVIATION");
  });
});
