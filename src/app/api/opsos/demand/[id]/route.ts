// OpsOS Demand lifecycle: create intent → validate → policy → resolve → allocate → plan → execute → complete
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { createIntent, validateIntent, evaluatePolicy, resolveCapabilities, allocateResources, createExecutionPlan, executePlan, completePlan } from "@/lib/kernel/intent";
import { z } from "zod";

export const maxDuration = 60;

const intentSchema = z.object({ intentKey: z.string(), parameters: z.record(z.string(), z.any()), protocolId: z.string().optional() });
const completeSchema = z.object({ qualityScore: z.number().optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "intent";

    if (action === "intent") {
      const body = await parseJson(req, intentSchema);
      return { intent: await createIntent("", id, body) }; // orgId from demand
    }
    if (action === "plan") return createExecutionPlan(id);
    if (action === "execute") return executePlan(id);
    if (action === "complete") {
      const body = await parseJson(req, completeSchema);
      return completePlan(id, body.qualityScore);
    }
    return { error: "Unknown action" };
  });
}
