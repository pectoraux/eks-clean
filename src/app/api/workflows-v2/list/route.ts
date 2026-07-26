// Workflow v2 — list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createWorkflowV2, listWorkflowsV2 } from "@/lib/modules/workflow-v2/service";
import { z } from "zod";

const schema = z.object({
  organizationId: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  serviceTypeId: z.string().optional(),
  entityType: z.string().default("BOOKING"),
  estimatedDurationMin: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "workflows:read" as never);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    const serviceTypeId = url.searchParams.get("serviceTypeId") || undefined;
    if (!orgId) return { items: [] };
    return { items: await listWorkflowsV2(orgId, serviceTypeId) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "workflows:manage" as never);
    const body = await parseJson(req, schema);
    return { workflow: await createWorkflowV2(body, session?.sub) };
  });
}
