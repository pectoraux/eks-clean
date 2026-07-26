// Workflow definitions — list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createDefinition, listDefinitions } from "@/lib/modules/workflows/service";
import { z } from "zod";

const schema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  entityType: z.string(),
  states: z.array(z.object({
    key: z.string(),
    label: z.string(),
    isInitial: z.boolean().optional(),
    isFinal: z.boolean().optional(),
    color: z.string().optional(),
  })),
  transitions: z.array(z.object({
    from: z.string(),
    to: z.string(),
    key: z.string(),
    label: z.string().optional(),
    guardConditions: z.record(z.unknown()).optional(),
    actions: z.array(z.string()).optional(),
  })),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workflows:read");
    const url = new URL(req.url);
    return { items: await listDefinitions(url.searchParams.get("entityType") || undefined) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workflows:manage");
    const body = await parseJson(req, schema);
    return { definition: await createDefinition(body, session?.sub) };
  });
}
