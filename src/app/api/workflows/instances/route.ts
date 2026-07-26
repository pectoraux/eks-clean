// Workflow instances — list + start + transition
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { startInstance, instancesForEntity } from "@/lib/modules/workflows/service";
import { db } from "@/lib/db";
import { z } from "zod";

const startSchema = z.object({
  definitionId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  context: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workflows:read");
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType") || undefined;
    const entityId = url.searchParams.get("entityId") || undefined;
    if (entityType && entityId) {
      return { items: await instancesForEntity(entityType, entityId) };
    }
    const items = await db.workflowInstance.findMany({
      include: { definition: true, _count: { select: { transitionLogs: true } } },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workflows:execute");
    const body = await parseJson(req, startSchema);
    return { instance: await startInstance(body.definitionId, body.entityType, body.entityId, body.context) };
  });
}
