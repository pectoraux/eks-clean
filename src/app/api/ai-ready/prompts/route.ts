// AI prompt templates — list + create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createPromptTemplate } from "@/lib/modules/ai-ready/service";
import { z } from "zod";

const schema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  systemPrompt: z.string(),
  userPromptTemplate: z.string(),
  variables: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().default(false),
    default: z.unknown().optional(),
  })).default([]),
  model: z.string().default("gpt-4o-mini"),
  temperature: z.number().default(0.3),
  maxTokens: z.number().int().default(1024),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:runs:read");
    const items = await db.aiPromptTemplate.findMany({ orderBy: { createdAt: "desc" } });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:prompts:manage");
    const body = await parseJson(req, schema);
    return { template: await createPromptTemplate({ ...body, createdBy: session?.sub }) };
  });
}
