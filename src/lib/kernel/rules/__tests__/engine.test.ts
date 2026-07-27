/**
 * OpsOS Rules Engine — Condition evaluation tests
 */
import { describe, it, expect } from "bun:test";
import { evaluateConditions, type RuleCondition } from "../index";

describe("Rules Engine — Condition evaluation", () => {
  it("matches EQ", () => {
    const c: RuleCondition[] = [{ field: "status", operator: "EQ", value: "COMPLETED" }];
    expect(evaluateConditions(c, { status: "COMPLETED" })).toBe(true);
    expect(evaluateConditions(c, { status: "OPEN" })).toBe(false);
  });

  it("matches GT/LT/GTE/LTE", () => {
    expect(evaluateConditions([{ field: "x", operator: "GT", value: 5 }], { x: 10 })).toBe(true);
    expect(evaluateConditions([{ field: "x", operator: "GT", value: 5 }], { x: 3 })).toBe(false);
    expect(evaluateConditions([{ field: "x", operator: "LT", value: 5 }], { x: 3 })).toBe(true);
    expect(evaluateConditions([{ field: "x", operator: "GTE", value: 5 }], { x: 5 })).toBe(true);
    expect(evaluateConditions([{ field: "x", operator: "LTE", value: 5 }], { x: 5 })).toBe(true);
  });

  it("matches IN/NOT_IN", () => {
    expect(evaluateConditions([{ field: "cat", operator: "IN", value: ["A", "B"] }], { cat: "A" })).toBe(true);
    expect(evaluateConditions([{ field: "cat", operator: "IN", value: ["A", "B"] }], { cat: "C" })).toBe(false);
    expect(evaluateConditions([{ field: "cat", operator: "NOT_IN", value: ["A", "B"] }], { cat: "C" })).toBe(true);
  });

  it("matches CONTAINS", () => {
    expect(evaluateConditions([{ field: "notes", operator: "CONTAINS", value: "urgent" }], { notes: "this is urgent" })).toBe(true);
    expect(evaluateConditions([{ field: "notes", operator: "CONTAINS", value: "urgent" }], { notes: "normal" })).toBe(false);
  });

  it("matches BETWEEN", () => {
    expect(evaluateConditions([{ field: "temp", operator: "BETWEEN", value: [18, 25] }], { temp: 20 })).toBe(true);
    expect(evaluateConditions([{ field: "temp", operator: "BETWEEN", value: [18, 25] }], { temp: 30 })).toBe(false);
  });

  it("combines with AND", () => {
    const c: RuleCondition[] = [
      { field: "rating", operator: "LT", value: 3 },
      { field: "isSubscriber", operator: "EQ", value: true, logicOperator: "AND" },
    ];
    expect(evaluateConditions(c, { rating: 2, isSubscriber: true })).toBe(true);
    expect(evaluateConditions(c, { rating: 2, isSubscriber: false })).toBe(false);
  });

  it("combines with OR", () => {
    const c: RuleCondition[] = [
      { field: "rating", operator: "LT", value: 3 },
      { field: "complaints", operator: "GT", value: 2, logicOperator: "OR" },
    ];
    expect(evaluateConditions(c, { rating: 5, complaints: 3 })).toBe(true);
    expect(evaluateConditions(c, { rating: 5, complaints: 0 })).toBe(false);
  });

  it("returns true for empty conditions", () => {
    expect(evaluateConditions([], {})).toBe(true);
  });

  it("handles nested field paths", () => {
    expect(evaluateConditions([{ field: "resource.capacity", operator: "GT", value: 10 }], { resource: { capacity: 20 } })).toBe(true);
    expect(evaluateConditions([{ field: "resource.capacity", operator: "GT", value: 10 }], { resource: { capacity: 5 } })).toBe(false);
  });
});
