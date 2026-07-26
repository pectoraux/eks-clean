/**
 * Rules Engine — pure-logic unit tests
 *  - Condition evaluation (all operators), AND/OR logic, nested fields
 */
import { describe, it, expect } from "bun:test";
import { evaluateConditions, prepareActions } from "../service";

describe("Rules Engine — condition evaluation", () => {
  const conditions = [
    { field: "rating.overall", operator: "LT", valueJson: "3", logicOperator: "AND" },
  ];

  it("matches LT operator", () => {
    expect(evaluateConditions(conditions, { rating: { overall: 2 } })).toBe(true);
    expect(evaluateConditions(conditions, { rating: { overall: 4 } })).toBe(false);
  });

  it("matches GT operator", () => {
    const c = [{ field: "total", operator: "GT", valueJson: "1000", logicOperator: "AND" }];
    expect(evaluateConditions(c, { total: 2000 })).toBe(true);
    expect(evaluateConditions(c, { total: 500 })).toBe(false);
  });

  it("matches EQ operator", () => {
    const c = [{ field: "status", operator: "EQ", valueJson: "\"COMPLETED\"", logicOperator: "AND" }];
    expect(evaluateConditions(c, { status: "COMPLETED" })).toBe(true);
    expect(evaluateConditions(c, { status: "OPEN" })).toBe(false);
  });

  it("matches IN operator", () => {
    const c = [{ field: "category", operator: "IN", valueJson: "[\"CLEANING\",\"LAUNDRY\"]", logicOperator: "AND" }];
    expect(evaluateConditions(c, { category: "CLEANING" })).toBe(true);
    expect(evaluateConditions(c, { category: "WASTE" })).toBe(false);
  });

  it("matches CONTAINS operator", () => {
    const c = [{ field: "notes", operator: "CONTAINS", valueJson: "\"urgent\"", logicOperator: "AND" }];
    expect(evaluateConditions(c, { notes: "This is urgent please" })).toBe(true);
    expect(evaluateConditions(c, { notes: "Normal request" })).toBe(false);
  });

  it("matches BETWEEN operator", () => {
    const c = [{ field: "temperature", operator: "BETWEEN", valueJson: "[18,25]", logicOperator: "AND" }];
    expect(evaluateConditions(c, { temperature: 20 })).toBe(true);
    expect(evaluateConditions(c, { temperature: 30 })).toBe(false);
  });

  it("combines multiple conditions with AND", () => {
    const c = [
      { field: "rating", operator: "LT", valueJson: "3", logicOperator: "AND" },
      { field: "isSubscriber", operator: "EQ", valueJson: "true", logicOperator: "AND" },
    ];
    expect(evaluateConditions(c, { rating: 2, isSubscriber: true })).toBe(true);
    expect(evaluateConditions(c, { rating: 2, isSubscriber: false })).toBe(false);
    expect(evaluateConditions(c, { rating: 4, isSubscriber: true })).toBe(false);
  });

  it("combines conditions with OR", () => {
    const c = [
      { field: "rating", operator: "LT", valueJson: "3", logicOperator: "AND" },
      { field: "complaintCount", operator: "GT", valueJson: "2", logicOperator: "OR" },
    ];
    expect(evaluateConditions(c, { rating: 4, complaintCount: 3 })).toBe(true); // OR matches
    expect(evaluateConditions(c, { rating: 4, complaintCount: 0 })).toBe(false); // neither matches
  });

  it("returns true for empty conditions (always match)", () => {
    expect(evaluateConditions([], {})).toBe(true);
  });

  it("handles nested field paths", () => {
    const c = [{ field: "property.squareMeters", operator: "GT", valueJson: "200", logicOperator: "AND" }];
    expect(evaluateConditions(c, { property: { squareMeters: 250 } })).toBe(true);
    expect(evaluateConditions(c, { property: { squareMeters: 100 } })).toBe(false);
    expect(evaluateConditions(c, {})).toBe(false); // undefined > 200 = false
  });
});

describe("Rules Engine — action preparation", () => {
  it("prepares actions in order", () => {
    const actions = [
      { id: "a1", actionType: "NOTIFY", order: 2, configJson: '{"role":"MANAGER"}', isAsync: false },
      { id: "a2", actionType: "CREATE_INSPECTION", order: 1, configJson: '{"type":"QUALITY"}', isAsync: true },
    ];
    const prepared = prepareActions(actions);
    expect(prepared).toHaveLength(2);
    expect(prepared[0].actionType).toBe("CREATE_INSPECTION"); // order 1 first
    expect(prepared[1].actionType).toBe("NOTIFY");
    expect(prepared[0].config).toEqual({ type: "QUALITY" });
  });

  it("handles null config", () => {
    const actions = [{ id: "a1", actionType: "NOTIFY", order: 1, configJson: null, isAsync: false }];
    const prepared = prepareActions(actions);
    expect(prepared[0].config).toEqual({});
  });
});
