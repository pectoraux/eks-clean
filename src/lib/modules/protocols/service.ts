/**
 * ============================================================================
 *  Cleaning Protocol Engine — recipes, executions, compliance scoring
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

export interface ProtocolStepInput {
  title: string;
  description?: string;
  expectedDurationMin: number;
  requiresPhoto?: boolean;
  ppeRequired?: string;
  equipmentRequired?: string;
  qualityChecklist?: string[];
  chemicals?: Array<{ itemId: string; quantityPerSqM?: number; notes?: string }>;
}

export interface ProtocolInput {
  code: string;
  name: string;
  description?: string;
  serviceTypeId?: string;
  surfaceCode?: string;
  estimatedDurationMin: number;
  safetyNotes?: string;
  steps: ProtocolStepInput[];
  createdBy?: string;
}

export async function createProtocol(input: ProtocolInput) {
  const existing = await db.cleaningProtocol.findUnique({ where: { code: input.code } });
  if (existing) throw conflict(`Protocol ${input.code} already exists`);

  const protocol = await db.cleaningProtocol.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      serviceTypeId: input.serviceTypeId,
      surfaceCode: input.surfaceCode,
      estimatedDurationMin: input.estimatedDurationMin,
      safetyNotes: input.safetyNotes,
      createdBy: input.createdBy,
      steps: { create: input.steps.map((s, i) => ({
        order: i + 1,
        title: s.title,
        description: s.description,
        expectedDurationMin: s.expectedDurationMin,
        requiresPhoto: s.requiresPhoto ?? false,
        ppeRequired: s.ppeRequired,
        equipmentRequired: s.equipmentRequired,
        qualityChecklist: s.qualityChecklist ? JSON.stringify(s.qualityChecklist) : null,
        chemicals: s.chemicals ? { create: s.chemicals.map((c) => ({
          itemId: c.itemId,
          quantityPerSqM: c.quantityPerSqM,
          notes: c.notes,
        })) } : undefined,
      })) },
    },
    include: { steps: { include: { chemicals: true } } },
  });

  await publish({ eventType: "protocol.created", payload: { protocolId: protocol.id, code: input.code } });
  return protocol;
}

export async function listProtocols(filter: { serviceTypeId?: string; surfaceCode?: string; activeOnly?: boolean } = {}) {
  return db.cleaningProtocol.findMany({
    where: {
      ...(filter.serviceTypeId ? { serviceTypeId: filter.serviceTypeId } : {}),
      ...(filter.surfaceCode ? { surfaceCode: filter.surfaceCode } : {}),
      ...(filter.activeOnly === false ? {} : { isActive: true }),
    },
    include: { _count: { select: { steps: true, executions: true } }, serviceType: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProtocol(id: string) {
  const p = await db.cleaningProtocol.findUnique({
    where: { id },
    include: {
      steps: { include: { chemicals: { include: { item: true } } }, orderBy: { order: "asc" } },
      serviceType: true,
      _count: { select: { executions: true } },
    },
  });
  if (!p) throw notFound("Protocol not found");
  return p;
}

// ---------------------------------------------------------------------------
//  Execution lifecycle
// ---------------------------------------------------------------------------

export async function startExecution(input: {
  protocolId: string;
  workerId: string;
  bookingId?: string;
}) {
  const [protocol, worker] = await Promise.all([
    db.cleaningProtocol.findUnique({ where: { id: input.protocolId }, include: { steps: true } }),
    db.worker.findUnique({ where: { id: input.workerId } }),
  ]);
  if (!protocol) throw notFound("Protocol not found");
  if (!worker) throw notFound("Worker not found");

  const execution = await db.protocolExecution.create({
    data: {
      protocolId: input.protocolId,
      workerId: input.workerId,
      bookingId: input.bookingId,
      status: "IN_PROGRESS",
      stepExecutions: {
        create: protocol.steps.map((s) => ({
          stepId: s.id,
          status: "PENDING",
        })),
      },
    },
    include: { stepExecutions: true },
  });

  await publish({
    eventType: "protocol.execution_started",
    payload: { executionId: execution.id, protocolId: input.protocolId, workerId: input.workerId },
  });
  return execution;
}

export async function completeStep(
  executionId: string,
  stepId: string,
  data: {
    photoUrl?: string;
    notes?: string;
    deviationFlag?: boolean;
    deviationReason?: string;
    checklistResults?: Array<{ item: string; passed: boolean }>;
    actualDurationMin?: number;
  },
) {
  const stepExec = await db.protocolStepExecution.findFirst({
    where: { executionId, stepId },
  });
  if (!stepExec) throw notFound("Step execution not found");

  const updated = await db.protocolStepExecution.update({
    where: { id: stepExec.id },
    data: {
      status: data.deviationFlag ? "COMPLETED" : "COMPLETED",
      completedAt: new Date(),
      photoUrl: data.photoUrl,
      notes: data.notes,
      deviationFlag: data.deviationFlag ?? false,
      deviationReason: data.deviationReason,
      checklistResultsJson: data.checklistResults ? JSON.stringify(data.checklistResults) : null,
      actualDurationMin: data.actualDurationMin,
    },
  });

  await publish({
    eventType: "protocol.step_completed",
    payload: { executionId, stepId, deviation: data.deviationFlag ?? false },
  });
  return updated;
}

export async function finishExecution(executionId: string, customerFeedback?: string) {
  const execution = await db.protocolExecution.findUnique({
    where: { id: executionId },
    include: { stepExecutions: true },
  });
  if (!execution) throw notFound("Execution not found");

  // Compute compliance score
  const totalSteps = execution.stepExecutions.length;
  const completed = execution.stepExecutions.filter((s) => s.status === "COMPLETED").length;
  const deviations = execution.stepExecutions.filter((s) => s.deviationFlag).length;
  const complianceScore = totalSteps > 0 ? ((completed - deviations * 0.5) / totalSteps) * 100 : 0;

  const status = complianceScore >= 80 ? "COMPLETED" : deviations > 0 ? "DEVIATION" : "COMPLETED";

  const updated = await db.protocolExecution.update({
    where: { id: executionId },
    data: {
      status,
      completedAt: new Date(),
      complianceScore: Math.max(0, complianceScore),
      customerFeedback,
      deviationNotes: deviations > 0
        ? `${deviations} step(s) deviated from protocol`
        : null,
    },
  });

  await publish({
    eventType: "protocol.execution_completed",
    payload: { executionId, complianceScore, status },
  });
  return updated;
}
