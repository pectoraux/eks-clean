// AI embeddings — store + retrieve
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { storeEmbedding, getEmbeddingsForEntity } from "@/lib/modules/ai-ready/service";
import { z } from "zod";

const schema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  vector: z.array(z.number()),
  chunkText: z.string(),
  chunkIndex: z.number().int().default(0),
  embeddingModel: z.string().default("text-embedding-3-small"),
  promptTemplateId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:runs:read");
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType");
    const entityId = url.searchParams.get("entityId");
    if (!entityType || !entityId) return { items: [] };
    return { items: await getEmbeddingsForEntity(entityType, entityId) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "ai:prompts:manage");
    const body = await parseJson(req, schema);
    return { embedding: await storeEmbedding(body) };
  });
}
