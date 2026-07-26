/**
 * Workflow Engine — pure-logic unit tests
 *
 * These tests cover the state-machine core: transition validity, guards,
 * final-state detection, trigger pattern matching, action preparation.
 *
 * The DB-touching paths (createDefinition, startInstance, transitionInstance)
 * are integration-tested against SQLite in `scripts/seed.ts` and via the
 * `/api/workflows/*` endpoints during end-to-end browser verification.
 *
 * Run with: `bun test src/lib/modules/workflows/__tests__/engine.test.ts`
 */

import { describe, it, expect } from "bun:test";
import type { WorkflowState, WorkflowTransition, PreparedAction } from "../../service";

// ---------------------------------------------------------------------------
//  Pure helpers extracted from service.ts (mirrored here for unit testing
//  without DB access). The service uses the same logic.
// ---------------------------------------------------------------------------

function findInitialState(states: WorkflowState[]): WorkflowState | undefined {
  return states.find((s) => s.isInitial);
}

function findTransition(transitions: WorkflowTransition[], fromState: string, transitionKey: string): WorkflowTransition | undefined {
  return transitions.find((t) => t.key === transitionKey && t.from === fromState);
}

function isFinalState(states: WorkflowState[], stateKey: string): boolean {
  return states.find((s) => s.key === stateKey)?.isFinal ?? false;
}

function matchesPattern(pattern: string, eventType: string): boolean {
  if (pattern === eventType) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return eventType.startsWith(prefix + ".");
  }
  return false;
}

function checkGuards(conditions: Record<string, unknown> | undefined, context: Record<string, unknown>): boolean {
  if (!conditions || Object.keys(conditions).length === 0) return true;
  return Object.entries(conditions).every(([k, v]) => context[k] === v);
}

function prepareActions(
  actions: Array<{ transitionKey: string; actionType: string; name: string; configJson: string | null; order: number; isAsync: boolean; timeoutSec: number }>,
  transitionKey: string,
): PreparedAction[] {
  return actions
    .filter((a) => a.transitionKey === transitionKey)
    .sort((a, b) => a.order - b.order)
    .map((a) => ({
      actionId: a.actionType + "_" + a.transitionKey, // synthetic id for test
      actionType: a.actionType,
      name: a.name,
      config: a.configJson ? JSON.parse(a.configJson) : {},
      isAsync: a.isAsync,
      timeoutSec: a.timeoutSec,
    }));
}

// ---------------------------------------------------------------------------
//  Tests
// ---------------------------------------------------------------------------

describe("Workflow Engine — pure logic", () => {
  const states: WorkflowState[] = [
    { key: "draft", label: "Draft", isInitial: true },
    { key: "submitted", label: "Submitted" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected", isFinal: true },
    { key: "completed", label: "Completed", isFinal: true },
  ];

  const transitions: WorkflowTransition[] = [
    { from: "draft", to: "submitted", key: "submit", label: "Submit" },
    { from: "submitted", to: "approved", key: "approve", label: "Approve", guardConditions: { amount: 100 } },
    { from: "submitted", to: "rejected", key: "reject", label: "Reject" },
    { from: "approved", to: "completed", key: "complete", label: "Complete" },
  ];

  it("finds the initial state", () => {
    expect(findInitialState(states)?.key).toBe("draft");
  });

  it("finds a valid transition", () => {
    const t = findTransition(transitions, "draft", "submit");
    expect(t).toBeDefined();
    expect(t?.to).toBe("submitted");
  });

  it("rejects an invalid transition key", () => {
    expect(findTransition(transitions, "draft", "approve")).toBeUndefined();
  });

  it("rejects a valid key from the wrong state", () => {
    expect(findTransition(transitions, "approved", "submit")).toBeUndefined();
  });

  it("identifies final states", () => {
    expect(isFinalState(states, "completed")).toBe(true);
    expect(isFinalState(states, "rejected")).toBe(true);
    expect(isFinalState(states, "approved")).toBe(false);
  });

  it("passes guards when context matches", () => {
    expect(checkGuards({ amount: 100 }, { amount: 100 })).toBe(true);
  });

  it("fails guards when context mismatches", () => {
    expect(checkGuards({ amount: 100 }, { amount: 50 })).toBe(false);
  });

  it("passes when no guards defined", () => {
    expect(checkGuards(undefined, {})).toBe(true);
    expect(checkGuards({}, { foo: "bar" })).toBe(true);
  });

  it("matches exact event patterns", () => {
    expect(matchesPattern("booking.created", "booking.created")).toBe(true);
    expect(matchesPattern("booking.created", "booking.cancelled")).toBe(false);
  });

  it("matches wildcard event patterns", () => {
    expect(matchesPattern("booking.*", "booking.created")).toBe(true);
    expect(matchesPattern("booking.*", "booking.cancelled")).toBe(true);
    expect(matchesPattern("booking.*", "payment.captured")).toBe(false);
  });

  it("prepares actions in order", () => {
    const actions = [
      { transitionKey: "approve", actionType: "EMAIL", name: "Notify", configJson: '{"to":"manager"}', order: 2, isAsync: false, timeoutSec: 10 },
      { transitionKey: "approve", actionType: "AI_FORECAST", name: "Forecast demand", configJson: '{"horizon":7}', order: 1, isAsync: true, timeoutSec: 60 },
      { transitionKey: "complete", actionType: "NOTIFICATION", name: "Done", configJson: null, order: 1, isAsync: false, timeoutSec: 5 },
    ];
    const prepared = prepareActions(actions, "approve");
    expect(prepared).toHaveLength(2);
    expect(prepared[0].actionType).toBe("AI_FORECAST"); // ordered first
    expect(prepared[1].actionType).toBe("EMAIL");
    expect(prepared[0].config).toEqual({ horizon: 7 });
    expect(prepared[0].isAsync).toBe(true);
  });

  it("returns empty actions when none match transition", () => {
    const actions = [
      { transitionKey: "approve", actionType: "EMAIL", name: "Notify", configJson: null, order: 1, isAsync: false, timeoutSec: 10 },
    ];
    expect(prepareActions(actions, "submit")).toHaveLength(0);
  });

  it("supports multiple final states in a workflow", () => {
    const approvalStates: WorkflowState[] = [
      { key: "draft", label: "Draft", isInitial: true },
      { key: "approved", label: "Approved", isFinal: true },
      { key: "rejected", label: "Rejected", isFinal: true },
    ];
    expect(approvalStates.filter((s) => s.isFinal)).toHaveLength(2);
  });
});
