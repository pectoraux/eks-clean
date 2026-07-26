// AI agent runs — start + complete
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { startAgentRun, completeAgentRun } from "@/lib/modules/ai-ready/service";
import { z } from "zod";

const startSchema = z.object({
  agentType: z.string(),
  promptTemplateId: z.string().optional(),
  triggerEventId: z.string().optional(),
  inputJson: z.record(z.string(), z.any()),
});

const completeSchema = z.object({
  outputJson: z.record(z.string(), z.any()),
  modelUsed: z.string(),
  promptTokens: z.number().int(),
  completionTokens: z.number().int(),
  totalCostMinor: z.number().int(),
  latencyMs: z.number().int(),
  errorMessage: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:runs:read");
    const url = new URL(req.url);
    const agentType = url.searchParams.get("agentType") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const items = await db.aiAgentRun.findMany({
      where: { ...(agentType ? { agentType } : {}), ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:prompts:manage");
    const body = await parseJson(req, startSchema);
    return { runId: await startAgentRun(body) };
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:prompts:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, completeSchema);
    return { run: await completeAgentRun(id, body) };
  });
}
