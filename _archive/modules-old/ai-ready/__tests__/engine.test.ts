/**
 * AI-Ready — pure-logic unit tests
 *  - Prompt template rendering, variable validation, cost tracking
 */

import { describe, it, expect } from "bun:test";

// Mirror of renderPrompt variable substitution
function renderPrompt(template: string, variables: Record<string, unknown>): string {
  let result = template;
  for (const [k, v] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v ?? ""));
  }
  return result;
}

// Mirror of variable validation
function validateVariables(template: string, variables: Array<{ name: string; required: boolean; default?: unknown }>, provided: Record<string, unknown>): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const v of variables) {
    if (v.required && !(v.name in provided) && v.default === undefined) {
      missing.push(v.name);
    }
  }
  return { valid: missing.length === 0, missing };
}

// Mirror of agent run cost calculation
function computeRunCost(promptTokens: number, completionTokens: number, inputCostPer1k: number, outputCostPer1k: number): number {
  return Math.round((promptTokens / 1000) * inputCostPer1k + (completionTokens / 1000) * outputCostPer1k);
}

// Mirror of prediction resolution accuracy (same as analytics-event-sourced)
function computeAccuracy(predicted: number, actual: number): number {
  if (actual === 0) return 0;
  return Math.max(0, 1 - Math.abs(actual - predicted) / Math.abs(actual));
}

describe("AI-Ready — prompt rendering", () => {
  it("substitutes variables into the template", () => {
    const result = renderPrompt("Hello {{name}}, your role is {{role}}.", { name: "Ama", role: "ADMIN" });
    expect(result).toBe("Hello Ama, your role is ADMIN.");
  });

  it("handles missing variables (leaves placeholder)", () => {
    const result = renderPrompt("Hello {{name}}", {});
    expect(result).toBe("Hello {{name}}");
  });

  it("substitutes the same variable multiple times", () => {
    const result = renderPrompt("{{x}} and {{x}} again", { x: "yes" });
    expect(result).toBe("yes and yes again");
  });

  it("handles numeric and boolean values", () => {
    const result = renderPrompt("Count: {{n}}, Active: {{b}}", { n: 42, b: true });
    expect(result).toBe("Count: 42, Active: true");
  });

  it("handles null and undefined values", () => {
    const result = renderPrompt("V: {{x}}", { x: null });
    expect(result).toBe("V: ");
  });
});

describe("AI-Ready — variable validation", () => {
  const vars = [
    { name: "customerName", required: true },
    { name: "issueType", required: true },
    { name: "priority", required: false, default: "NORMAL" },
  ];

  it("passes when all required variables are provided", () => {
    const r = validateVariables("", vars, { customerName: "Ama", issueType: "refund" });
    expect(r.valid).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("fails when a required variable is missing", () => {
    const r = validateVariables("", vars, { customerName: "Ama" });
    expect(r.valid).toBe(false);
    expect(r.missing).toEqual(["issueType"]);
  });

  it("passes when a required variable has a default", () => {
    const varsWithDefault = [
      { name: "priority", required: true, default: "NORMAL" },
    ];
    const r = validateVariables("", varsWithDefault, {});
    expect(r.valid).toBe(true);
  });

  it("passes when no variables are required", () => {
    const r = validateVariables("", [], {});
    expect(r.valid).toBe(true);
  });
});

describe("AI-Ready — cost tracking", () => {
  it("computes run cost from token counts and per-1k prices", () => {
    // 1000 prompt tokens × ₵0.05/1k + 500 completion tokens × ₵0.15/1k = 50 + 75 = 125
    expect(computeRunCost(1000, 500, 50, 150)).toBe(125);
  });

  it("returns zero cost for zero tokens", () => {
    expect(computeRunCost(0, 0, 50, 150)).toBe(0);
  });

  it("handles fractional tokens (rounds to nearest minor)", () => {
    // 500 prompt × 0.05/1k = 25, 250 completion × 0.15/1k = 37.5 → 62.5 → 63
    expect(computeRunCost(500, 250, 50, 150)).toBe(63);
  });
});

describe("AI-Ready — prediction accuracy", () => {
  it("scores perfect accuracy", () => {
    expect(computeAccuracy(50, 50)).toBe(1);
  });

  it("scores zero when actual is zero", () => {
    expect(computeAccuracy(50, 0)).toBe(0);
  });

  it("scores partial accuracy", () => {
    expect(computeAccuracy(80, 100)).toBe(0.8); // 1 - 20/100
  });

  it("clamps negative accuracy to zero", () => {
    expect(computeAccuracy(200, 50)).toBe(0); // 1 - 150/50 = -2 → 0
  });
});
