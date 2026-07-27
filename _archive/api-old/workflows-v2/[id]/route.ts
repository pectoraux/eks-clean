// Workflow v2 detail + validate + add stage/task
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { getWorkflowV2, addStage, addTask, addChecklistItem, addRequiredSkill, addRequiredProduct, addApprovalRule, addQualityGate, validateWorkflow, canWorkerPerformTask } from "@/lib/modules/workflow-v2/service";
import { z } from "zod";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "workflows:read" as never);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "validate") return validateWorkflow(id);
    return { workflow: await getWorkflowV2(id) };
  });
}

const stageSchema = z.object({ name: z.string(), description: z.string().optional(), stageType: z.string().default("EXECUTION"), estimatedDurationMin: z.number().int().optional(), isRequired: z.boolean().default(true) });
const taskSchema = z.object({ title: z.string(), description: z.string().optional(), estimatedDurationMin: z.number().int().optional(), isRequired: z.boolean().default(true), requiresPhoto: z.boolean().default(false) });
const checklistSchema = z.object({ item: z.string(), isRequired: z.boolean().default(true), order: z.number().int().default(0) });
const skillSchema = z.object({ skillCode: z.string(), minLevel: z.number().int().default(1) });
const productSchema = z.object({ itemId: z.string().optional(), productCode: z.string().optional(), quantity: z.number().default(1), unit: z.string().default("UNIT") });
const approvalSchema = z.object({ approverRole: z.string(), approverUserId: z.string().optional(), autoApproveIfScoreGte: z.number().optional() });
const gateSchema = z.object({ metric: z.string(), threshold: z.number().optional(), failureAction: z.string().default("BLOCK") });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "workflows:manage" as never);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "stage";
    if (action === "stage") { const body = await parseJson(req, stageSchema); return { stage: await addStage(id, body) }; }
    return { error: "Use /stages/[sid]/tasks/[tid]/* endpoints for task-level operations" };
  });
}
