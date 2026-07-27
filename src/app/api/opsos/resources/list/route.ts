// OpsOS Resources — list + create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  organizationId: z.string(), code: z.string(), name: z.string(),
  resourceType: z.string(), status: z.string().default("ACTIVE"),
  latitude: z.number().optional(), longitude: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(), capacity: z.record(z.string(), z.any()).optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    const items = await db.resource.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: { _count: { select: { capabilities: true, reservations: true, schedules: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const body = await parseJson(req, schema);
    return { resource: await db.resource.create({ data: {
      organizationId: body.organizationId, code: body.code, name: body.name,
      resourceType: body.resourceType, status: body.status,
      latitude: body.latitude, longitude: body.longitude,
      metadataJson: body.metadata ? JSON.stringify(body.metadata) : null,
      capacityJson: body.capacity ? JSON.stringify(body.capacity) : null,
    } }) };
  });
}
