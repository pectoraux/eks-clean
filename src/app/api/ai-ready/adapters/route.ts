// AI workflow adapters — list + create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createWorkflowAdapter } from "@/lib/modules/ai-ready/service";
import { z } from "zod";

const schema = z.object({
  workflowActionId: z.string().optional(),
  agentType: z.string(),
  promptTemplateKey: z.string().optional(),
  triggerConditions: z.record(z.string(), z.any()).optional(),
  outputMapping: z.record(z.string(), z.any()).optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:runs:read");
    const items = await db.aiWorkflowAdapter.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:prompts:manage");
    const body = await parseJson(req, schema);
    return { adapter: await createWorkflowAdapter(body) };
  });
}
