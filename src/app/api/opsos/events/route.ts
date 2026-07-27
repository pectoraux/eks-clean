// OpsOS Events — list + append (Event Store)
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { appendEvent, getEvents, getAggregateHistory } from "@/lib/kernel/event-store";
import { z } from "zod";

export const maxDuration = 60;

const appendSchema = z.object({
  organizationId: z.string(), aggregateType: z.string(), aggregateId: z.string(),
  eventType: z.string(), payload: z.record(z.string(), z.any()),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (!orgId) return { items: [] };
    const aggregateType = url.searchParams.get("aggregateType") || undefined;
    const aggregateId = url.searchParams.get("aggregateId") || undefined;
    const eventType = url.searchParams.get("eventType") || undefined;
    const limit = Number(url.searchParams.get("limit") ?? 100);
    if (aggregateType && aggregateId && !eventType) return { items: await getAggregateHistory(orgId, aggregateType, aggregateId) };
    return { items: await getEvents(orgId, { aggregateType, eventType, limit }) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const body = await parseJson(req, appendSchema);
    return appendEvent(body.organizationId, body);
  });
}
