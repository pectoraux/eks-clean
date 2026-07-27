/**
 * ============================================================================
 *  OpsOS Intent Engine — Compiles Demand into Execution Plans
 * ============================================================================
 *  Universal lifecycle:
 *    Demand → Intent → Validation → Policy → Capability → Resource →
 *    Scheduling → Routing → Execution Plan → Execution
 * ============================================================================
 */

import { db } from "@/lib/db";
import { appendEvent } from "../event-store";
import type { RuntimeClock } from "../runtime/clock";

export async function createDemand(organizationId: string, input: {
  source?: string; capabilityCode?: string; quantity?: number;
  constraints?: Record<string, unknown>; customerId?: string;
  priority?: string; metadata?: Record<string, unknown>;
}, clock?: RuntimeClock) {
  const code = `DEM-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const demand = await db.demand.create({
    data: {
      organizationId, code, source: input.source ?? "EXTERNAL",
      capabilityCode: input.capabilityCode, quantity: input.quantity ?? 1,
      constraintsJson: input.constraints ? JSON.stringify(input.constraints) : null,
      customerId: input.customerId, priority: input.priority ?? "NORMAL",
      status: "DETECTED", metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
  await appendEvent(organizationId, {
    aggregateType: "DEMAND", aggregateId: demand.id, eventType: "demand.detected",
    payload: { code, capabilityCode: input.capabilityCode, priority: input.priority },
  }, clock);
  return demand;
}

export async function createIntent(organizationId: string, demandId: string, input: {
  intentKey: string; intentVersion?: string; parameters: Record<string, unknown>;
  protocolId?: string;
}, clock?: RuntimeClock) {
  const intent = await db.intent.create({
    data: {
      organizationId, code: `INT-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      demandId, intentKey: input.intentKey, intentVersion: input.intentVersion ?? "1.0.0",
      parametersJson: JSON.stringify(input.parameters), protocolId: input.protocolId,
    },
  });
  await db.demand.update({ where: { id: demandId }, data: { status: "INTENT_CREATED", intentId: intent.id } });
  await appendEvent(organizationId, {
    aggregateType: "INTENT", aggregateId: intent.id, eventType: "intent.created",
    payload: { demandId, intentKey: input.intentKey },
  }, clock);
  return intent;
}

export async function validateIntent(intentId: string, clock?: RuntimeClock): Promise<{ valid: boolean; errors?: string[] }> {
  const intent = await db.intent.findUnique({ where: { id: intentId } });
  if (!intent) throw new Error("Intent not found");

  // Basic validation: parameters must be valid JSON and contain required fields
  const params = JSON.parse(intent.parametersJson) as Record<string, unknown>;
  const errors: string[] = [];
  if (!params || Object.keys(params).length === 0) errors.push("Parameters are required");

  const valid = errors.length === 0;
  await db.intent.update({
    where: { id: intentId },
    data: { validationStatus: valid ? "VALID" : "INVALID", validationErrors: errors.join("; ") || null },
  });
  await appendEvent(intent.organizationId, {
    aggregateType: "INTENT", aggregateId: intentId, eventType: "intent.validated",
    payload: { valid, errors },
  }, clock);
  return { valid, errors: errors.length > 0 ? errors : undefined };
}

export async function evaluatePolicy(intentId: string, clock?: RuntimeClock): Promise<{ allowed: boolean; decisions: unknown[] }> {
  const intent = await db.intent.findUnique({ where: { id: intentId } });
  if (!intent) throw new Error("Intent not found");

  // Find applicable policies
  const policies = await db.policy.findMany({
    where: { organizationId: intent.organizationId, isActive: true },
    orderBy: { priority: "asc" },
  });

  const decisions: unknown[] = [];
  let allowed = true;
  for (const policy of policies) {
    const decision = { policyKey: policy.key, effect: policy.effect, conditions: policy.conditionsJson };
    decisions.push(decision);
    if (policy.effect === "DENY") allowed = false;
  }

  await db.intent.update({
    where: { id: intentId },
    data: { policyStatus: allowed ? "ALLOWED" : "DENIED", policyDecisionsJson: JSON.stringify(decisions) },
  });
  await appendEvent(intent.organizationId, {
    aggregateType: "INTENT", aggregateId: intentId, eventType: "intent.policy_evaluated",
    payload: { allowed, decisionCount: decisions.length },
  }, clock);
  return { allowed, decisions };
}

export async function resolveCapabilities(intentId: string, clock?: RuntimeClock): Promise<{ resolved: boolean; capabilities: string[] }> {
  const intent = await db.intent.findUnique({ where: { id: intentId } });
  if (!intent) throw new Error("Intent not found");

  // Find capabilities matching the intent key
  const capabilities = await db.capability.findMany({
    where: { organizationId: intent.organizationId, isActive: true },
  });

  const resolved = capabilities.length > 0;
  await db.intent.update({
    where: { id: intentId },
    data: {
      resolutionStatus: resolved ? "RESOLVED" : "UNRESOLVED",
      resolvedCapabilitiesJson: JSON.stringify(capabilities.map((c) => c.code)),
    },
  });
  await appendEvent(intent.organizationId, {
    aggregateType: "INTENT", aggregateId: intentId, eventType: "intent.capabilities_resolved",
    payload: { resolved, count: capabilities.length },
  }, clock);
  return { resolved, capabilities: capabilities.map((c) => c.code) };
}

export async function allocateResources(intentId: string, clock?: RuntimeClock): Promise<{ allocated: boolean; resources: string[] }> {
  const intent = await db.intent.findUnique({ where: { id: intentId } });
  if (!intent) throw new Error("Intent not found");

  // Find available resources
  const resources = await db.resource.findMany({
    where: { organizationId: intent.organizationId, status: "ACTIVE" },
    take: 1,
  });

  const allocated = resources.length > 0;
  await db.intent.update({
    where: { id: intentId },
    data: {
      allocationStatus: allocated ? "ALLOCATED" : "FAILED",
      allocatedResourcesJson: JSON.stringify(resources.map((r) => r.id)),
    },
  });
  await appendEvent(intent.organizationId, {
    aggregateType: "INTENT", aggregateId: intentId, eventType: "intent.resources_allocated",
    payload: { allocated, count: resources.length },
  }, clock);
  return { allocated, resources: resources.map((r) => r.id) };
}

export async function createExecutionPlan(intentId: string, clock?: RuntimeClock) {
  const intent = await db.intent.findUnique({ where: { id: intentId } });
  if (!intent) throw new Error("Intent not found");

  const plan = await db.executionPlan.create({
    data: {
      organizationId: intent.organizationId, code: `PLAN-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      intentId, demandId: intent.demandId, status: "PLANNED",
      planJson: JSON.stringify({ intentKey: intent.intentKey, stages: [] }),
      runtimeTick: clock?.tick() ?? null,
      deterministic: true,
    },
  });

  await db.intent.update({ where: { id: intentId }, data: { planStatus: "PLANNED", executionPlanId: plan.id } });
  await db.demand.update({ where: { id: intent.demandId! }, data: { status: "PLANNED", executionPlanId: plan.id } });

  await appendEvent(intent.organizationId, {
    aggregateType: "EXECUTION_PLAN", aggregateId: plan.id, eventType: "execution_plan.created",
    payload: { intentId, code: plan.code },
  }, clock);

  return plan;
}

export async function executePlan(planId: string, clock?: RuntimeClock) {
  const plan = await db.executionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Execution plan not found");

  await db.executionPlan.update({ where: { id: planId }, data: { status: "EXECUTING", actualStart: clock?.now() ?? new Date() } });
  await appendEvent(plan.organizationId, {
    aggregateType: "EXECUTION_PLAN", aggregateId: planId, eventType: "execution_plan.started",
    payload: { code: plan.code },
  }, clock);
  return { status: "EXECUTING" };
}

export async function completePlan(planId: string, qualityScore?: number, clock?: RuntimeClock) {
  const plan = await db.executionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Execution plan not found");

  await db.executionPlan.update({
    where: { id: planId },
    data: { status: "COMPLETED", actualEnd: clock?.now() ?? new Date(), qualityScore },
  });

  if (plan.demandId) {
    await db.demand.update({ where: { id: plan.demandId }, data: { status: "COMPLETED" } });
  }

  await appendEvent(plan.organizationId, {
    aggregateType: "EXECUTION_PLAN", aggregateId: planId, eventType: "execution_plan.completed",
    payload: { qualityScore },
  }, clock);
  return { status: "COMPLETED" };
}
