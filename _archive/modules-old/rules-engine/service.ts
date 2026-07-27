/**
 * Rules Engine — configurable IF/THEN rules
 * ============================================================================
 *  Rule structure:
 *    Rule (triggerEvent, priority, isActive)
 *      → RuleCondition[] (field, operator, value) — AND/OR logic
 *      → RuleAction[] (actionType, config) — executed in order
 *      → RuleExecution (log of every fire)
 *
 *  Example rule:
 *    trigger: "booking.rated"
 *    conditions: [{ field: "rating.overall", operator: "LT", value: 3 }]
 *    actions: [
 *      { type: "CREATE_INSPECTION", config: { type: "QUALITY" } },
 *      { type: "NOTIFY", config: { role: "FIELD_MANAGER", message: "Low rating" } },
 *      { type: "APPLY_DISCOUNT", config: { percent: 10 } },
 *    ]
 *
 *  The evaluateConditions() function is pure + testable.
 *  The executeActions() function returns prepared payloads — actual execution
 *  (creating inspections, sending notifications) is delegated to a runner.
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  CRUD
// ---------------------------------------------------------------------------

export async function createRule(input: {
  organizationId: string; name: string; description?: string;
  triggerEvent: string; triggerType?: string; scope?: string; scopeId?: string;
  priority?: number; isActive?: boolean; maxExecutionsPerDay?: number; cooldownMinutes?: number;
  createdBy?: string;
  conditions: Array<{ field: string; operator: string; value: unknown; logicOperator?: string }>;
  actions: Array<{ actionType: string; name?: string; config: Record<string, unknown>; isAsync?: boolean }>;
}) {
  const rule = await db.rule.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      triggerEvent: input.triggerEvent,
      triggerType: input.triggerType ?? "EVENT",
      scope: input.scope ?? "ORGANIZATION",
      scopeId: input.scopeId,
      priority: input.priority ?? 100,
      isActive: input.isActive ?? true,
      maxExecutionsPerDay: input.maxExecutionsPerDay ?? 0,
      cooldownMinutes: input.cooldownMinutes ?? 0,
      createdBy: input.createdBy,
      conditions: {
        create: input.conditions.map((c, i) => ({
          order: i,
          field: c.field,
          operator: c.operator,
          valueJson: JSON.stringify(c.value),
          logicOperator: c.logicOperator ?? "AND",
        })),
      },
      actions: {
        create: input.actions.map((a, i) => ({
          order: i,
          actionType: a.actionType,
          name: a.name,
          configJson: JSON.stringify(a.config),
          isAsync: a.isAsync ?? false,
        })),
      },
    },
    include: { conditions: { orderBy: { order: "asc" } }, actions: { orderBy: { order: "asc" } } },
  });
  await publish({ eventType: "rule.created", payload: { ruleId: rule.id, triggerEvent: input.triggerEvent } });
  return rule;
}

export async function listRules(organizationId: string, triggerEvent?: string) {
  return db.rule.findMany({
    where: {
      organizationId,
      ...(triggerEvent ? { triggerEvent } : {}),
    },
    include: { _count: { select: { conditions: true, actions: true, executions: true } } },
    orderBy: [{ isActive: "desc" }, { priority: "asc" }],
  });
}

export async function getRule(id: string) {
  const rule = await db.rule.findUnique({
    where: { id },
    include: {
      conditions: { orderBy: { order: "asc" } },
      actions: { orderBy: { order: "asc" } },
      _count: { select: { executions: true } },
    },
  });
  if (!rule) throw notFound("Rule not found");
  return rule;
}

// ---------------------------------------------------------------------------
//  Condition evaluation — pure function, testable
// ============================================================================

export interface EvaluableContext {
  [key: string]: unknown;
}

export function evaluateConditions(
  conditions: Array<{ field: string; operator: string; valueJson: string; logicOperator: string }>,
  context: EvaluableContext,
): boolean {
  if (conditions.length === 0) return true; // no conditions = always match

  let result = true;
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    const fieldValue = getNestedField(context, cond.field);
    const conditionValue = JSON.parse(cond.valueJson);
    const matched = evaluateCondition(fieldValue, cond.operator, conditionValue);

    if (i === 0) {
      result = matched;
    } else if (cond.logicOperator === "OR") {
      result = result || matched;
    } else {
      result = result && matched;
    }
  }
  return result;
}

function getNestedField(obj: EvaluableContext, path: string): unknown {
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
    case "CONTAINS":
      return typeof fieldValue === "string" && typeof conditionValue === "string"
        ? fieldValue.includes(conditionValue) : false;
    case "STARTS_WITH":
      return typeof fieldValue === "string" && typeof conditionValue === "string"
        ? fieldValue.startsWith(conditionValue) : false;
    case "ENDS_WITH":
      return typeof fieldValue === "string" && typeof conditionValue === "string"
        ? fieldValue.endsWith(conditionValue) : false;
    case "BETWEEN":
      return Array.isArray(conditionValue) && conditionValue.length === 2
        ? Number(fieldValue) >= Number(conditionValue[0]) && Number(fieldValue) <= Number(conditionValue[1])
        : false;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
//  Action preparation — returns payloads without executing (testable)
// ---------------------------------------------------------------------------

export interface PreparedAction {
  actionId: string;
  actionType: string;
  order: number;
  config: Record<string, unknown>;
  isAsync: boolean;
}

export function prepareActions(
  actions: Array<{ id: string; actionType: string; order: number; configJson: string | null; isAsync: boolean }>,
): PreparedAction[] {
  return actions
    .sort((a, b) => a.order - b.order)
    .map((a) => ({
      actionId: a.id,
      actionType: a.actionType,
      order: a.order,
      config: a.configJson ? JSON.parse(a.configJson) : {},
      isAsync: a.isAsync,
    }));
}

// ---------------------------------------------------------------------------
//  Rule execution — evaluate conditions, prepare actions, log execution
// ---------------------------------------------------------------------------

export async function evaluateRule(ruleId: string, context: EvaluableContext, triggerEventId?: string): Promise<{
  ruleId: string;
  conditionsMatched: boolean;
  preparedActions: PreparedAction[];
}> {
  const rule = await db.rule.findUnique({
    where: { id: ruleId },
    include: {
      conditions: { orderBy: { order: "asc" } },
      actions: { orderBy: { order: "asc" } },
    },
  });
  if (!rule) throw notFound("Rule not found");
  if (!rule.isActive) return { ruleId, conditionsMatched: false, preparedActions: [] };

  const conditionsMatched = evaluateConditions(rule.conditions, context);
  const preparedActions = conditionsMatched ? prepareActions(rule.actions) : [];

  // Log the execution
  await db.ruleExecution.create({
    data: {
      ruleId,
      triggerEventId,
      entityType: context.entityType as string | undefined,
      entityId: context.entityId as string | undefined,
      status: conditionsMatched ? "COMPLETED" : "SKIPPED",
      conditionsMatched,
      actionsExecutedJson: JSON.stringify(preparedActions),
      completedAt: new Date(),
      durationMs: 0,
    },
  });

  if (conditionsMatched) {
    await publish({ eventType: "rule.fired", payload: { ruleId, ruleName: rule.name, actionsCount: preparedActions.length } });
  }

  return { ruleId, conditionsMatched, preparedActions };
}

// ---------------------------------------------------------------------------
//  Find rules for a trigger event + evaluate all matching ones
// ---------------------------------------------------------------------------

export async function evaluateRulesForEvent(
  organizationId: string,
  triggerEvent: string,
  context: EvaluableContext,
  triggerEventId?: string,
): Promise<Array<{ ruleId: string; conditionsMatched: boolean; preparedActions: PreparedAction[] }>> {
  const rules = await db.rule.findMany({
    where: { organizationId, triggerEvent, isActive: true },
    orderBy: { priority: "asc" },
  });
  const results = [];
  for (const rule of rules) {
    const result = await evaluateRule(rule.id, context, triggerEventId);
    results.push(result);
  }
  return results;
}

// ---------------------------------------------------------------------------
//  Rule metrics
// ---------------------------------------------------------------------------

export async function ruleMetrics(organizationId: string) {
  const [totalRules, activeRules, totalExecutions, firedExecutions, skippedExecutions, recentExecutions] = await Promise.all([
    db.rule.count({ where: { organizationId } }),
    db.rule.count({ where: { organizationId, isActive: true } }),
    db.ruleExecution.count({ where: { rule: { organizationId } } }),
    db.ruleExecution.count({ where: { rule: { organizationId }, conditionsMatched: true } }),
    db.ruleExecution.count({ where: { rule: { organizationId }, conditionsMatched: false } }),
    db.ruleExecution.findMany({
      where: { rule: { organizationId }, status: "COMPLETED" },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { rule: { select: { name: true, triggerEvent: true } } },
    }),
  ]);
  return { totalRules, activeRules, totalExecutions, firedExecutions, skippedExecutions, recentExecutions };
}
