/**
 * ============================================================================
 *  OpsOS Rules Engine — Declarative Business Behavior
 * ============================================================================
 *  Rules are data, never embedded in code.
 *  Conditions: 12 operators (EQ, NE, GT, GTE, LT, LTE, IN, NOT_IN, CONTAINS,
 *  STARTS_WITH, ENDS_WITH, BETWEEN) with AND/OR logic.
 *  Actions: pluggable (CREATE_TASK, NOTIFY, APPLY_DISCOUNT, ASSIGN_RESOURCE, etc.)
 * ============================================================================
 */

import { db } from "@/lib/db";
import { appendEvent } from "../event-store";

// ---------------------------------------------------------------------------
//  Condition evaluation — pure function, deterministic, testable
// ---------------------------------------------------------------------------

export interface RuleCondition {
  field: string;
  operator: string;
  value: unknown;
  logicOperator?: "AND" | "OR";
}

export function evaluateConditions(conditions: RuleCondition[], context: Record<string, unknown>): boolean {
  if (conditions.length === 0) return true;
  let result = true;
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const fieldValue = getNestedField(context, cond.field);
    const matched = evaluateCondition(fieldValue, cond.operator, cond.value);
    if (i === 0) result = matched;
    else if (cond.logicOperator === "OR") result = result || matched;
    else result = result && matched;
  }
  return result;
}

function getNestedField(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

function evaluateCondition(fieldValue: unknown, operator: string, conditionValue: unknown): boolean {
  switch (operator) {
    case "EQ": return fieldValue === conditionValue;
    case "NE": return fieldValue !== conditionValue;
    case "GT": return Number(fieldValue) > Number(conditionValue);
    case "GTE": return Number(fieldValue) >= Number(conditionValue);
    case "LT": return Number(fieldValue) < Number(conditionValue);
    case "LTE": return Number(fieldValue) <= Number(conditionValue);
    case "IN": return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
    case "NOT_IN": return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
    case "CONTAINS": return typeof fieldValue === "string" && typeof conditionValue === "string" && fieldValue.includes(conditionValue);
    case "STARTS_WITH": return typeof fieldValue === "string" && typeof conditionValue === "string" && fieldValue.startsWith(conditionValue);
    case "ENDS_WITH": return typeof fieldValue === "string" && typeof conditionValue === "string" && fieldValue.endsWith(conditionValue);
    case "BETWEEN": return Array.isArray(conditionValue) && conditionValue.length === 2 && Number(fieldValue) >= Number(conditionValue[0]) && Number(fieldValue) <= Number(conditionValue[1]);
    default: return false;
  }
}

// ---------------------------------------------------------------------------
//  Rule evaluation
// ---------------------------------------------------------------------------

export interface RuleAction {
  actionType: string;
  config: Record<string, unknown>;
  isAsync?: boolean;
}

export async function evaluateRulesForEvent(
  organizationId: string,
  triggerEvent: string,
  context: Record<string, unknown>,
): Promise<Array<{ ruleId: string; ruleName: string; matched: boolean; actions: RuleAction[] }>> {
  const rules = await db.rule.findMany({
    where: { organizationId, triggerEvent, isActive: true },
    orderBy: { priority: "asc" },
  });

  const results = [];
  for (const rule of rules) {
    const conditions = JSON.parse(rule.conditionsJson) as RuleCondition[];
    const matched = evaluateConditions(conditions, context);
    const actions = matched ? (JSON.parse(rule.actionsJson) as RuleAction[]) : [];

    // Log execution
    await db.ruleExecution.create({
      data: {
        ruleId: rule.id,
        entityType: context.entityType as string | undefined,
        entityId: context.entityId as string | undefined,
        status: matched ? "COMPLETED" : "SKIPPED",
        conditionsMatched: matched,
        actionsExecutedJson: JSON.stringify(actions),
        completedAt: new Date(),
        durationMs: 0,
      },
    });

    if (matched) {
      await appendEvent(organizationId, {
        aggregateType: "RULE",
        aggregateId: rule.id,
        eventType: "rule.fired",
        payload: { ruleName: rule.name, actionsCount: actions.length },
      });
    }

    results.push({ ruleId: rule.id, ruleName: rule.name, matched, actions });
  }
  return results;
}

// ---------------------------------------------------------------------------
//  Rule CRUD
// ---------------------------------------------------------------------------

export async function createRule(organizationId: string, input: {
  name: string; description?: string; triggerEvent: string; triggerType?: string;
  priority?: number; isActive?: boolean; conditions: RuleCondition[]; actions: RuleAction[];
  scope?: string; scopeId?: string; protocolId?: string; createdBy?: string;
}) {
  return db.rule.create({
    data: {
      organizationId,
      name: input.name,
      description: input.description,
      triggerEvent: input.triggerEvent,
      triggerType: input.triggerType ?? "EVENT",
      priority: input.priority ?? 100,
      isActive: input.isActive ?? true,
      conditionsJson: JSON.stringify(input.conditions),
      actionsJson: JSON.stringify(input.actions),
      scope: input.scope ?? "ORGANIZATION",
      scopeId: input.scopeId,
      protocolId: input.protocolId,
      createdBy: input.createdBy,
    },
  });
}

export async function listRules(organizationId: string, triggerEvent?: string) {
  return db.rule.findMany({
    where: { organizationId, ...(triggerEvent ? { triggerEvent } : {}) },
    include: { _count: { select: { executions: true } } },
    orderBy: [{ isActive: "desc" }, { priority: "asc" }],
  });
}
