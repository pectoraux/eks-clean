/**
 * ============================================================================
 *  Configurable Workflow Engine v2
 *  Workflow → Stage → Task → Checklist → RequiredSkill → RequiredProduct → ApprovalRule → QualityGate
 * ============================================================================
 *  This is the "service intelligence" layer. Instead of hardcoding cleaning,
 *  laundry, and waste as separate codepaths, each service is configured as a
 *  workflow. Adding pest control = create a new WorkflowDefinitionV2 with the
 *  right stages/tasks/checklists — no code changes.
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Workflow Definition CRUD
// ---------------------------------------------------------------------------

export async function createWorkflowV2(input: {
  organizationId: string;
  key: string;
  name: string;
  description?: string;
  serviceTypeId?: string;
  entityType?: string;
  estimatedDurationMin?: number;
}, createdBy?: string) {
  const existing = await db.workflowDefinitionV2.findUnique({
    where: { organizationId_key: { organizationId: input.organizationId, key: input.key } },
  });
  if (existing) throw conflict(`Workflow ${input.key} already exists in this organization`);

  return db.workflowDefinitionV2.create({ data: input });
}

export async function getWorkflowV2(id: string) {
  const wf = await db.workflowDefinitionV2.findUnique({
    where: { id },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          tasks: {
            orderBy: { order: "asc" },
            include: {
              checklists: { orderBy: { order: "asc" } },
              requiredSkills: true,
              requiredProducts: true,
              approvalRules: true,
              qualityGates: true,
            },
          },
        },
      },
    },
  });
  if (!wf) throw notFound("Workflow not found");
  return wf;
}

export async function listWorkflowsV2(organizationId: string, serviceTypeId?: string) {
  return db.workflowDefinitionV2.findMany({
    where: {
      organizationId,
      isActive: true,
      ...(serviceTypeId ? { serviceTypeId } : {}),
    },
    include: { _count: { select: { stages: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
//  Stage + Task management
// ---------------------------------------------------------------------------

export async function addStage(workflowId: string, input: {
  name: string; description?: string; stageType?: string; estimatedDurationMin?: number; isRequired?: boolean;
}) {
  const wf = await db.workflowDefinitionV2.findUnique({ where: { id: workflowId } });
  if (!wf) throw notFound("Workflow not found");
  const stageCount = await db.workflowStage.count({ where: { workflowId } });
  return db.workflowStage.create({
    data: { ...input, workflowId, order: stageCount + 1 },
  });
}

export async function addTask(stageId: string, input: {
  title: string; description?: string; estimatedDurationMin?: number; isRequired?: boolean; requiresPhoto?: boolean;
}) {
  const stage = await db.workflowStage.findUnique({ where: { id: stageId } });
  if (!stage) throw notFound("Stage not found");
  const taskCount = await db.workflowTask.count({ where: { stageId } });
  return db.workflowTask.create({
    data: { ...input, stageId, order: taskCount + 1 },
  });
}

export async function addChecklistItem(taskId: string, input: { item: string; isRequired?: boolean; order?: number }) {
  return db.workflowChecklist.create({ data: { ...input, taskId } });
}

export async function addRequiredSkill(taskId: string, input: { skillCode: string; minLevel?: number }) {
  const existing = await db.workflowRequiredSkill.findUnique({
    where: { taskId_skillCode: { taskId, skillCode: input.skillCode } },
  });
  if (existing) throw conflict("Required skill already exists for this task");
  return db.workflowRequiredSkill.create({ data: { ...input, taskId } });
}

export async function addRequiredProduct(taskId: string, input: { itemId?: string; productCode?: string; quantity?: number; unit?: string }) {
  if (!input.itemId && !input.productCode) throw badRequest("Either itemId or productCode is required");
  return db.workflowRequiredProduct.create({ data: { ...input, taskId } });
}

export async function addApprovalRule(taskId: string, input: {
  approverRole: string; approverUserId?: string; autoApproveIfScoreGte?: number;
}) {
  return db.workflowApprovalRule.create({ data: { ...input, taskId } });
}

export async function addQualityGate(taskId: string, input: {
  metric: string; threshold?: number; failureAction?: string;
}) {
  return db.workflowQualityGate.create({ data: { ...input, taskId } });
}

// ---------------------------------------------------------------------------
//  Worker-task matching — can this worker do this task?
// ---------------------------------------------------------------------------

export async function canWorkerPerformTask(workerId: string, taskId: string): Promise<{ canPerform: boolean; missingSkills: string[] }> {
  const [worker, requiredSkills] = await Promise.all([
    db.worker.findUnique({ where: { id: workerId }, include: { skills: true, skillAssessments: { include: { skill: true } } } }),
    db.workflowRequiredSkill.findMany({ where: { taskId } }),
  ]);
  if (!worker) throw notFound("Worker not found");

  const missingSkills: string[] = [];
  for (const req of requiredSkills) {
    // Check worker has this skill at the required level
    const workerSkill = worker.skills.find((s) => s.skillCode === req.skillCode);
    const assessment = worker.skillAssessments.find((a) => a.skill.code === req.skillCode);
    const workerLevel = workerSkill?.proficiency === "EXPERT" ? 4
      : workerSkill?.proficiency === "ADVANCED" ? 3
      : workerSkill?.proficiency === "INTERMEDIATE" ? 2
      : workerSkill?.proficiency === "BEGINNER" ? 1
      : assessment?.level ?? 0;
    if (workerLevel < req.minLevel) {
      missingSkills.push(`${req.skillCode} (need level ${req.minLevel}, have ${workerLevel})`);
    }
  }

  return {
    canPerform: missingSkills.length === 0,
    missingSkills,
  };
}

// ---------------------------------------------------------------------------
//  Validate a workflow definition is complete
// ---------------------------------------------------------------------------

export async function validateWorkflow(workflowId: string): Promise<{ valid: boolean; issues: string[] }> {
  const wf = await getWorkflowV2(workflowId);
  const issues: string[] = [];

  if (wf.stages.length === 0) issues.push("Workflow has no stages");
  for (const stage of wf.stages) {
    if (stage.tasks.length === 0 && stage.isRequired) {
      issues.push(`Stage "${stage.name}" is required but has no tasks`);
    }
    for (const task of stage.tasks) {
      if (task.isRequired && task.checklists.length === 0 && task.qualityGates.length === 0) {
        issues.push(`Task "${task.title}" has no checklists or quality gates — workers won't know what to verify`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
//  Workflow metrics
// ---------------------------------------------------------------------------

export async function workflowMetricsV2(organizationId: string) {
  const [totalWorkflows, activeWorkflows, totalStages, totalTasks, totalChecklists] = await Promise.all([
    db.workflowDefinitionV2.count({ where: { organizationId } }),
    db.workflowDefinitionV2.count({ where: { organizationId, isActive: true } }),
    db.workflowStage.count({ where: { workflow: { organizationId } } }),
    db.workflowTask.count({ where: { stage: { workflow: { organizationId } } } }),
    db.workflowChecklist.count({ where: { task: { stage: { workflow: { organizationId } } } } }),
  ]);
  return { totalWorkflows, activeWorkflows, totalStages, totalTasks, totalChecklists };
}
