// Event-sourced analytics: events (record + read)
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { recordEvent, getEvents, getAggregateHistory } from "@/lib/modules/analytics-event-sourced/service";
import { z } from "zod";

const recordSchema = z.object({
  aggregateType: z.string(),
  aggregateId: z.string(),
  eventType: z.string(),
  payload: z.record(z.string(), z.any()),
  metadata: z.object({
    actorId: z.string().optional(),
    actorType: z.string().optional(),
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    correlationId: z.string().optional(),
  }).optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:events:read");
    const url = new URL(req.url);
    const aggregateType = url.searchParams.get("aggregateType") || undefined;
    const aggregateId = url.searchParams.get("aggregateId") || undefined;
    const eventType = url.searchParams.get("eventType") || undefined;
    const since = url.searchParams.get("since") ? new Date(url.searchParams.get("since")!) : undefined;
    const until = url.searchParams.get("until") ? new Date(url.searchParams.get("until")!) : undefined;
    const limit = Number(url.searchParams.get("limit") ?? 100);

    if (aggregateType && aggregateId && !eventType) {
      return { items: await getAggregateHistory(aggregateType, aggregateId) };
    }
    return { items: await getEvents({ aggregateType, aggregateId, eventType, since, until, limit }) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:projections:manage");
    const body = await parseJson(req, recordSchema);
    return { event: await recordEvent(body) };
  });
}
