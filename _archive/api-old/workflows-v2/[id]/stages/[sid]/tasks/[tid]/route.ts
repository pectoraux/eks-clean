// Add task to stage
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { addTask, addChecklistItem, addRequiredSkill, addRequiredProduct, addApprovalRule, addQualityGate, canWorkerPerformTask } from "@/lib/modules/workflow-v2/service";
import { z } from "zod";

const taskSchema = z.object({ title: z.string(), description: z.string().optional(), estimatedDurationMin: z.number().int().optional(), isRequired: z.boolean().default(true), requiresPhoto: z.boolean().default(false) });
const checklistSchema = z.object({ item: z.string(), isRequired: z.boolean().default(true), order: z.number().int().default(0) });
const skillSchema = z.object({ skillCode: z.string(), minLevel: z.number().int().default(1) });
const productSchema = z.object({ itemId: z.string().optional(), productCode: z.string().optional(), quantity: z.number().default(1), unit: z.string().default("UNIT") });
const approvalSchema = z.object({ approverRole: z.string(), approverUserId: z.string().optional(), autoApproveIfScoreGte: z.number().optional() });
const gateSchema = z.object({ metric: z.string(), threshold: z.number().optional(), failureAction: z.string().default("BLOCK") });

export async function POST(req: NextRequest, ctx: { params: Promise<{ sid: string; tid: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "workflows:manage" as never);
    const { sid, tid } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "checklist") { const body = await parseJson(req, checklistSchema); return { item: await addChecklistItem(tid, body) }; }
    if (action === "skill") { const body = await parseJson(req, skillSchema); return { skill: await addRequiredSkill(tid, body) }; }
    if (action === "product") { const body = await parseJson(req, productSchema); return { product: await addRequiredProduct(tid, body) }; }
    if (action === "approval") { const body = await parseJson(req, approvalSchema); return { rule: await addApprovalRule(tid, body) }; }
    if (action === "gate") { const body = await parseJson(req, gateSchema); return { gate: await addQualityGate(tid, body) }; }
    if (action === "can-perform") { const body = await parseJson(req, z.object({ workerId: z.string() })); return canWorkerPerformTask(body.workerId, tid); }
    return { error: "Unknown action" };
  });
}
