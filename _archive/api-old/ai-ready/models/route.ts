// AI model configs — list + register
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { registerModelConfig } from "@/lib/modules/ai-ready/service";
import { z } from "zod";

const schema = z.object({
  provider: z.string(),
  modelId: z.string(),
  displayName: z.string(),
  contextWindow: z.number().int().default(128000),
  inputCostPer1kMinor: z.number().int().default(0),
  outputCostPer1kMinor: z.number().int().default(0),
  capabilities: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:runs:read");
    const items = await db.aiModelConfig.findMany({ where: { isActive: true }, orderBy: { provider: "asc" } });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:prompts:manage");
    const body = await parseJson(req, schema);
    return { model: await registerModelConfig(body) };
  });
}
