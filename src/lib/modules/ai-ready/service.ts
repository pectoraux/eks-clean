/**
 * ============================================================================
 *  AI-Ready Data Structures
 * ============================================================================
 *  - Prompt templates (versioned, with variables + model config)
 *  - Model configs (provider, costs, capabilities)
 *  - Embeddings (entity-linked, pluggable vector store)
 *  - Agent runs (execution log with cost + latency tracking)
 *  - Predictions (with later resolution to actuals for accuracy scoring)
 *  - Workflow adapters (bind AI runs to workflow actions)
 *
 *  CRITICAL: This module does NOT call any LLM directly. It only stores the
 *  config + run metadata. A separate `AiRunner` (not in this build) would
 *  read the prompt template, call the model, store the output, and update
 *  the run. This keeps the data layer pure and unit-testable.
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Prompt templates
// ---------------------------------------------------------------------------

export async function createPromptTemplate(input: {
  key: string;
  name: string;
  description?: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables?: Array<{ name: string; type: string; required: boolean; default?: unknown }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  createdBy?: string;
}) {
  const existing = await db.aiPromptTemplate.findUnique({ where: { key: input.key } });
  if (existing) throw conflict(`Prompt template ${input.key} already exists`);

  return db.aiPromptTemplate.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description,
      systemPrompt: input.systemPrompt,
      userPromptTemplate: input.userPromptTemplate,
      variablesJson: JSON.stringify(input.variables ?? []),
      model: input.model ?? "gpt-4o-mini",
      temperature: input.temperature ?? 0.3,
      maxTokens: input.maxTokens ?? 1024,
      createdBy: input.createdBy,
    },
  });
}

export async function renderPrompt(templateKey: string, variables: Record<string, unknown>): Promise<{ systemPrompt: string; userPrompt: string; model: string; temperature: number; maxTokens: number }> {
  const template = await db.aiPromptTemplate.findUnique({ where: { key: templateKey } });
  if (!template) throw notFound(`Prompt template ${templateKey} not found`);
  if (!template.isActive) throw badRequest("Template is inactive");

  // Validate required variables
  const vars = JSON.parse(template.variablesJson) as Array<{ name: string; required: boolean; default?: unknown }>;
  for (const v of vars) {
    if (v.required && !(v.name in variables) && v.default === undefined) {
      throw badRequest(`Missing required variable: ${v.name}`);
    }
  }

  // Render the user prompt with simple {{variable}} substitution
  let userPrompt = template.userPromptTemplate;
  for (const [k, v] of Object.entries(variables)) {
    userPrompt = userPrompt.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v ?? ""));
  }
  // Substitute defaults for missing vars
  for (const v of vars) {
    if (!(v.name in variables) && v.default !== undefined) {
      userPrompt = userPrompt.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, "g"), String(v.default));
    }
  }

  return {
    systemPrompt: template.systemPrompt,
    userPrompt,
    model: template.model,
    temperature: template.temperature,
    maxTokens: template.maxTokens,
  };
}

// ---------------------------------------------------------------------------
//  Model configs
// ---------------------------------------------------------------------------

export async function registerModelConfig(input: {
  provider: string;
  modelId: string;
  displayName: string;
  contextWindow?: number;
  inputCostPer1kMinor?: number;
  outputCostPer1kMinor?: number;
  capabilities?: string[];
}) {
  return db.aiModelConfig.upsert({
    where: { provider_modelId: { provider: input.provider, modelId: input.modelId } },
    update: input,
    create: input,
  });
}

// ---------------------------------------------------------------------------
//  Agent runs — record the execution of an AI agent
//    (Called by the AiRunner after the model returns)
// ---------------------------------------------------------------------------

export async function startAgentRun(input: {
  agentType: string;
  promptTemplateId?: string;
  triggerEventId?: string;
  inputJson: Record<string, unknown>;
}): Promise<string> {
  const run = await db.aiAgentRun.create({
    data: {
      agentType: input.agentType,
      promptTemplateId: input.promptTemplateId,
      triggerEventId: input.triggerEventId,
      inputJson: JSON.stringify(input.inputJson),
      status: "PENDING",
    },
  });
  await publish({ eventType: "ai.agent_run_started", payload: { runId: run.id, agentType: input.agentType } });
  return run.id;
}

export async function completeAgentRun(runId: string, input: {
  outputJson: Record<string, unknown>;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  totalCostMinor: number;
  latencyMs: number;
  errorMessage?: string;
}) {
  const run = await db.aiAgentRun.findUnique({ where: { id: runId } });
  if (!run) throw notFound("Agent run not found");

  const updated = await db.aiAgentRun.update({
    where: { id: runId },
    data: {
      status: input.errorMessage ? "FAILED" : "COMPLETED",
      outputJson: JSON.stringify(input.outputJson),
      modelUsed: input.modelUsed,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalCostMinor: input.totalCostMinor,
      latencyMs: input.latencyMs,
      errorMessage: input.errorMessage,
      startedAt: run.startedAt ?? new Date(),
      completedAt: new Date(),
    },
  });

  await publish({
    eventType: "ai.agent_run_completed",
    payload: { runId, status: updated.status, costMinor: input.totalCostMinor, latencyMs: input.latencyMs },
  });
  return updated;
}

// ---------------------------------------------------------------------------
//  Predictions — stored with confidence + later resolved to actuals
// ---------------------------------------------------------------------------

export async function recordPrediction(input: {
  predictionType: string;
  entityType: string;
  entityId: string;
  predictedValue: number;
  confidence: number;
  horizonDays?: number;
  modelVersion?: string;
  featuresJson?: Record<string, unknown>;
}) {
  return db.aiPrediction.create({
    data: {
      ...input,
      featuresJson: input.featuresJson ? JSON.stringify(input.featuresJson) : null,
      horizonDays: input.horizonDays ?? 7,
    },
  });
}

export async function resolvePrediction(predictionId: string, actualValue: number) {
  const pred = await db.aiPrediction.findUnique({ where: { id: predictionId } });
  if (!pred) throw notFound("Prediction not found");
  if (pred.actualValue !== null && pred.actualValue !== undefined) {
    throw badRequest("Prediction already resolved");
  }

  // Compute accuracy: 1 - |actual - predicted| / |actual| (bounded to [0, 1])
  const error = Math.abs(actualValue - pred.predictedValue);
  const accuracy = actualValue !== 0 ? Math.max(0, 1 - error / Math.abs(actualValue)) : 0;

  return db.aiPrediction.update({
    where: { id: predictionId },
    data: { actualValue, accuracyScore: accuracy, resolvedAt: new Date() },
  });
}

export async function predictionAccuracyMetrics(predictionType?: string) {
  const resolved = await db.aiPrediction.findMany({
    where: {
      ...(predictionType ? { predictionType } : {}),
      actualValue: { not: null },
    },
    select: { accuracyScore: true, predictionType: true },
  });
  if (resolved.length === 0) return { totalResolved: 0, avgAccuracy: 0, byType: {} };
  const byType: Record<string, { count: number; avgAccuracy: number }> = {};
  for (const r of resolved) {
    if (!byType[r.predictionType]) byType[r.predictionType] = { count: 0, avgAccuracy: 0 };
    byType[r.predictionType].count++;
    byType[r.predictionType].avgAccuracy += r.accuracyScore ?? 0;
  }
  for (const t of Object.keys(byType)) {
    byType[t].avgAccuracy /= byType[t].count;
  }
  return {
    totalResolved: resolved.length,
    avgAccuracy: resolved.reduce((s, r) => s + (r.accuracyScore ?? 0), 0) / resolved.length,
    byType,
  };
}

// ---------------------------------------------------------------------------
//  Embeddings — store + retrieve by entity
// ---------------------------------------------------------------------------

export async function storeEmbedding(input: {
  entityType: string;
  entityId: string;
  vector: number[];
  chunkText: string;
  chunkIndex?: number;
  embeddingModel?: string;
  dimensions?: number;
  promptTemplateId?: string;
  metadata?: Record<string, unknown>;
}) {
  return db.aiEmbedding.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      vectorJson: JSON.stringify(input.vector),
      dimensions: input.dimensions ?? input.vector.length ?? 1536,
      chunkText: input.chunkText,
      chunkIndex: input.chunkIndex ?? 0,
      embeddingModel: input.embeddingModel ?? "text-embedding-3-small",
      promptTemplateId: input.promptTemplateId,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}

export async function getEmbeddingsForEntity(entityType: string, entityId: string) {
  return db.aiEmbedding.findMany({
    where: { entityType, entityId },
    orderBy: { chunkIndex: "asc" },
  });
}

// ---------------------------------------------------------------------------
//  Workflow adapters — bind AI agent runs to workflow actions
// ---------------------------------------------------------------------------

export async function createWorkflowAdapter(input: {
  workflowActionId?: string;
  agentType: string;
  promptTemplateKey?: string;
  triggerConditions?: Record<string, unknown>;
  outputMapping?: Record<string, unknown>;
}) {
  return db.aiWorkflowAdapter.create({
    data: {
      workflowActionId: input.workflowActionId,
      agentType: input.agentType,
      promptTemplateKey: input.promptTemplateKey,
      triggerConditionsJson: input.triggerConditions ? JSON.stringify(input.triggerConditions) : null,
      outputMappingJson: input.outputMapping ? JSON.stringify(input.outputMapping) : null,
      isActive: true,
    },
  });
}

// ---------------------------------------------------------------------------
//  AI dashboard metrics
// ---------------------------------------------------------------------------

export async function aiMetrics() {
  const [totalTemplates, totalRuns, completedRuns, failedRuns, totalPredictions, resolvedPredictions, totalEmbeddings, totalCost] = await Promise.all([
    db.aiPromptTemplate.count(),
    db.aiAgentRun.count(),
    db.aiAgentRun.count({ where: { status: "COMPLETED" } }),
    db.aiAgentRun.count({ where: { status: "FAILED" } }),
    db.aiPrediction.count(),
    db.aiPrediction.count({ where: { actualValue: { not: null } } }),
    db.aiEmbedding.count(),
    db.aiAgentRun.aggregate({ _sum: { totalCostMinor: true } }),
  ]);
  return {
    totalTemplates,
    totalRuns,
    completedRuns,
    failedRuns,
    successRate: totalRuns > 0 ? completedRuns / totalRuns : 0,
    totalPredictions,
    resolvedPredictions,
    totalEmbeddings,
    totalCostMinor: totalCost._sum.totalCostMinor ?? 0,
  };
}
