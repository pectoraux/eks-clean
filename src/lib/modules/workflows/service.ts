/**
 * ============================================================================
 *  Workflow Engine — configurable, versioned, AI-ready state machines
 * ============================================================================
 *  A WorkflowDefinition declares:
 *    - states:        [{ key, label, isInitial, isFinal, color }]
 *    - transitions:   [{ from, to, key, label, guardConditions?, actions? }]
 *    - actions:       per-transition side effects (WEBHOOK, AI_LLM, AI_FORECAST,
 *                      AI_CLASSIFY, EMAIL, NOTIFICATION, QUEUE_JOB,
 *                      UPDATE_FIELD, GATEWAY_CALL)
 *    - triggers:      event-pattern subscriptions that auto-start or auto-
 *                      transition an instance
 *
 *  This engine is intentionally side-effect-free at the data level: invoking
 *  an action returns the prepared payload (URL, prompt, queue job, etc.) and
 *  the caller is responsible for execution (so it remains unit-testable and
 *  sandbox-safe). In production, wire a `WorkflowActionRunner` that performs
 *  the actual fetch / queue.add / publish / LLM call.
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { broadcast, CHANNELS } from "@/lib/realtime";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

export interface WorkflowState {
  key: string;
  label: string;
  isInitial?: boolean;
  isFinal?: boolean;
  color?: string;
}

export interface WorkflowTransition {
  from: string;
  to: string;
  key: string;
  label?: string;
  guardConditions?: Record<string, unknown>;
  actions?: string[]; // action names
}

export interface WorkflowDefinitionSpec {
  key: string;
  name: string;
  description?: string;
  entityType: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  isActive?: boolean;
}

export interface PreparedAction {
  actionId: string;
  actionType: string;
  name: string;
  config: Record<string, unknown>;
  isAsync: boolean;
  timeoutSec: number;
}

// ---------------------------------------------------------------------------
//  CRUD
// ---------------------------------------------------------------------------

export async function createDefinition(spec: WorkflowDefinitionSpec, createdBy?: string) {
  const existing = await db.workflowDefinition.findUnique({ where: { key: spec.key } });
  if (existing) throw conflict(`Workflow '${spec.key}' already exists`);
  return db.workflowDefinition.create({
    data: {
      key: spec.key,
      name: spec.name,
      description: spec.description,
      entityType: spec.entityType,
      statesJson: JSON.stringify(spec.states),
      transitionsJson: JSON.stringify(spec.transitions),
      isActive: spec.isActive ?? true,
      createdBy,
    },
    include: { actions: true, triggers: true },
  });
}

export async function getDefinition(id: string) {
  const def = await db.workflowDefinition.findUnique({
    where: { id },
    include: { actions: true, triggers: true },
  });
  if (!def) throw notFound("Workflow definition not found");
  return def;
}

export async function listDefinitions(entityType?: string) {
  return db.workflowDefinition.findMany({
    where: { ...(entityType ? { entityType } : {}), isActive: true },
    include: { _count: { select: { instances: true, actions: true, triggers: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
//  Instance lifecycle
// ---------------------------------------------------------------------------

export async function startInstance(
  definitionId: string,
  entityType: string,
  entityId: string,
  context: Record<string, unknown> = {},
) {
  const def = await getDefinition(definitionId);
  const states = JSON.parse(def.statesJson) as WorkflowState[];
  const initial = states.find((s) => s.isInitial);
  if (!initial) throw badRequest("Workflow has no initial state");

  // Idempotency: one active instance per (entityType, entityId, definitionId)
  const existing = await db.workflowInstance.findFirst({
    where: { definitionId, entityType, entityId, completedAt: null },
  });
  if (existing) return existing;

  const instance = await db.workflowInstance.create({
    data: {
      definitionId,
      entityType,
      entityId,
      currentState: initial.key,
      contextJson: JSON.stringify(context),
      lastTransitionAt: new Date(),
    },
  });
  await db.workflowTransitionLog.create({
    data: {
      instanceId: instance.id,
      fromState: null,
      toState: initial.key,
      transitionKey: "__start__",
      actorType: "SYSTEM",
    },
  });
  await publish({
    eventType: "workflow.instance_started",
    payload: { instanceId: instance.id, definitionKey: def.key, entityId, initialState: initial.key },
  });
  return instance;
}

export async function transitionInstance(
  instanceId: string,
  transitionKey: string,
  actor: { id?: string; type?: string },
  contextUpdate?: Record<string, unknown>,
): Promise<{ instance: Awaited<ReturnType<typeof db.workflowInstance.update>>; preparedActions: PreparedAction[] }> {
  const instance = await db.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { definition: { include: { actions: true } } },
  });
  if (!instance) throw notFound("Instance not found");
  if (instance.completedAt) throw conflict("Instance already completed");

  const transitions = JSON.parse(instance.definition.transitionsJson) as WorkflowTransition[];
  const transition = transitions.find(
    (t) => t.key === transitionKey && t.from === instance.currentState,
  );
  if (!transition) {
    throw conflict(`Transition '${transitionKey}' not valid from state '${instance.currentState}'`);
  }

  // Optional guard check (simple equality-based conditions on context)
  if (transition.guardConditions && Object.keys(transition.guardConditions).length > 0) {
    const ctx = instance.contextJson ? JSON.parse(instance.contextJson) as Record<string, unknown> : {};
    for (const [k, v] of Object.entries(transition.guardConditions)) {
      if (ctx[k] !== v) {
        throw badRequest(`Guard failed: context.${k} expected ${String(v)}`);
      }
    }
  }

  // Update instance state
  const newContext = contextUpdate
    ? { ...(instance.contextJson ? JSON.parse(instance.contextJson) as Record<string, unknown> : {}), ...contextUpdate }
    : (instance.contextJson ? JSON.parse(instance.contextJson) as Record<string, unknown> : {});

  const states = JSON.parse(instance.definition.statesJson) as WorkflowState[];
  const targetState = states.find((s) => s.key === transition.to);
  const isFinal = targetState?.isFinal ?? false;

  const updated = await db.workflowInstance.update({
    where: { id: instanceId },
    data: {
      currentState: transition.to,
      contextJson: JSON.stringify(newContext),
      lastTransitionAt: new Date(),
      completedAt: isFinal ? new Date() : null,
    },
  });

  await db.workflowTransitionLog.create({
    data: {
      instanceId,
      fromState: instance.currentState,
      toState: transition.to,
      transitionKey,
      actorId: actor.id,
      actorType: actor.type,
      metadataJson: contextUpdate ? JSON.stringify(contextUpdate) : null,
    },
  });

  // Prepare actions for this transition (do NOT execute — runner is separate)
  const preparedActions: PreparedAction[] = instance.definition.actions
    .filter((a) => a.transitionKey === transitionKey)
    .sort((a, b) => a.order - b.order)
    .map((a) => ({
      actionId: a.id,
      actionType: a.actionType,
      name: a.name,
      config: a.configJson ? JSON.parse(a.configJson) : {},
      isAsync: a.isAsync,
      timeoutSec: a.timeoutSec,
    }));

  await publish({
    eventType: "workflow.transitioned",
    payload: { instanceId, transitionKey, from: instance.currentState, to: transition.to, completed: isFinal },
  });

  await broadcast(CHANNELS.adminOps(), "workflow:transition", {
    instanceId, transitionKey, from: instance.currentState, to: transition.to,
  });

  return { instance: updated, preparedActions };
}

// ---------------------------------------------------------------------------
//  Triggers — fire when matching event arrives
// ---------------------------------------------------------------------------

export async function findTriggersForEvent(eventType: string): Promise<Awaited<ReturnType<typeof db.workflowTrigger.findMany>>> {
  // Simple prefix match: "booking.created" matches pattern "booking.*" or "booking.created"
  return db.workflowTrigger.findMany({
    where: { isEnabled: true },
    include: { definition: true },
  });
}

export async function ingestEvent(eventType: string, payload: Record<string, unknown>): Promise<void> {
  const triggers = await findTriggersForEvent(eventType);
  for (const t of triggers) {
    if (!matchesPattern(t.eventPattern, eventType)) continue;
    // Conditions check (optional)
    if (t.conditionsJson) {
      try {
        const conds = JSON.parse(t.conditionsJson) as Record<string, unknown>;
        const ok = Object.entries(conds).every(([k, v]) => payload[k] === v);
        if (!ok) continue;
      } catch { /* ignore malformed conditions */ }
    }
    // Start an instance with this payload as context
    const def = t.definition;
    if (!def || !def.isActive) continue;
    // Use entityType+entityId from payload if present, else generate a synthetic id
    const entityId = (payload.id as string) || (payload.entityId as string) || `evt_${Date.now()}`;
    try {
      await startInstance(def.id, def.entityType, entityId, payload);
    } catch (e) {
      // Already exists, ignore
    }
  }
}

function matchesPattern(pattern: string, eventType: string): boolean {
  if (pattern === eventType) return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return eventType.startsWith(prefix + ".");
  }
  return false;
}

// ---------------------------------------------------------------------------
//  Helper: list instances for an entity (e.g. all workflows for a booking)
// ---------------------------------------------------------------------------

export async function instancesForEntity(entityType: string, entityId: string) {
  return db.workflowInstance.findMany({
    where: { entityType, entityId },
    include: { definition: true, transitionLogs: { orderBy: { at: "asc" } } },
    orderBy: { startedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
//  Helper: create a default booking workflow on first boot
// ---------------------------------------------------------------------------

export async function ensureDefaultBookingWorkflow(): Promise<void> {
  const existing = await db.workflowDefinition.findUnique({ where: { key: "booking.lifecycle" } });
  if (existing) return;
  await createDefinition({
    key: "booking.lifecycle",
    name: "Booking Lifecycle",
    description: "Default state machine for service bookings",
    entityType: "BOOKING",
    states: [
      { key: "draft", label: "Draft", isInitial: true, color: "gray" },
      { key: "requested", label: "Requested", color: "blue" },
      { key: "assigned", label: "Assigned", color: "indigo" },
      { key: "in_progress", label: "In Progress", color: "purple" },
      { key: "completed", label: "Completed", isFinal: true, color: "green" },
      { key: "cancelled", label: "Cancelled", isFinal: true, color: "red" },
    ],
    transitions: [
      { from: "draft", to: "requested", key: "submit", label: "Submit" },
      { from: "requested", to: "assigned", key: "assign", label: "Auto-Assign" },
      { from: "assigned", to: "in_progress", key: "start", label: "Start" },
      { from: "in_progress", to: "completed", key: "complete", label: "Complete" },
      { from: "requested", to: "cancelled", key: "cancel", label: "Cancel" },
      { from: "assigned", to: "cancelled", key: "cancel", label: "Cancel" },
      { from: "in_progress", to: "cancelled", key: "cancel", label: "Cancel" },
    ],
  });
}
