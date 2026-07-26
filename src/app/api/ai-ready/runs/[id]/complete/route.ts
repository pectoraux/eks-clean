import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { completeAgentRun } from "@/lib/modules/ai-ready/service";
import { z } from "zod";

const schema = z.object({
  outputJson: z.record(z.string(), z.any()),
  modelUsed: z.string(),
  promptTokens: z.number().int(),
  completionTokens: z.number().int(),
  totalCostMinor: z.number().int(),
  latencyMs: z.number().int(),
  errorMessage: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:prompts:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { run: await completeAgentRun(id, body) };
  });
}
