/**
 * ============================================================================
 *  Event-Sourced Analytics
 * ============================================================================
 *  Append-only event log (AnalyticsEvent) + materialized projections
 *  (AnalyticsProjection). Projections are rebuilt from events, so the source
 *  of truth is always the event log — projections are just caches.
 *
 *  Pattern:
 *    1. Domain code calls `recordEvent()` whenever something meaningful happens
 *    2. Projection builders (`rebuildProjection()`) consume events and update
 *       the materialized view
 *    3. Query API reads from projections (fast) or falls back to event scan
 *
 *  This is the foundation for AI agents: they can replay events to derive
 *  any view of the business.
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Recording events — appends to the log with monotonic per-aggregate version
// ---------------------------------------------------------------------------

export interface RecordEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata?: {
    actorId?: string;
    actorType?: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
  };
}

export async function recordEvent(input: RecordEventInput) {
  // Find current max version for this aggregate
  const lastEvent = await db.analyticsEvent.findFirst({
    where: { aggregateType: input.aggregateType, aggregateId: input.aggregateId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastEvent?.version ?? 0) + 1;

  const event = await db.analyticsEvent.create({
    data: {
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      version: nextVersion,
      payloadJson: JSON.stringify(input.payload),
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });

  // Notify projection builders (in-process for now; could be a queue job)
  await publish({
    eventType: `analytics.event_recorded`,
    payload: { eventId: event.id, aggregateType: input.aggregateType, aggregateId: input.aggregateId, eventType: input.eventType, version: nextVersion },
  });

  return event;
}

// ---------------------------------------------------------------------------
//  Reading events
// ---------------------------------------------------------------------------

export async function getEvents(filter: {
  aggregateType?: string;
  aggregateId?: string;
  eventType?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}) {
  return db.analyticsEvent.findMany({
    where: {
      ...(filter.aggregateType ? { aggregateType: filter.aggregateType } : {}),
      ...(filter.aggregateId ? { aggregateId: filter.aggregateId } : {}),
      ...(filter.eventType ? { eventType: filter.eventType } : {}),
      ...(filter.since || filter.until ? {
        occurredAt: {
          ...(filter.since ? { gte: filter.since } : {}),
          ...(filter.until ? { lte: filter.until } : {}),
        },
      } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: filter.limit ?? 100,
  });
}

export async function getAggregateHistory(aggregateType: string, aggregateId: string) {
  return db.analyticsEvent.findMany({
    where: { aggregateType, aggregateId },
    orderBy: { version: "asc" },
  });
}

// ---------------------------------------------------------------------------
//  Projections — materialized views rebuilt from events
// ============================================================================

export interface ProjectionBuilder {
  name: string;
  handles: (eventType: string) => boolean;
  build: (events: Awaited<ReturnType<typeof getEvents>>) => Promise<{ aggregateKey: string; value: unknown }[]>;
}

// Built-in projection: monthly revenue
const monthlyRevenueProjection: ProjectionBuilder = {
  name: "monthly_revenue",
  handles: (et) => et === "payment.captured",
  build: async (events) => {
    const byMonth = new Map<string, number>();
    for (const e of events) {
      const payload = JSON.parse(e.payloadJson) as { amountMinor?: number };
      const month = e.occurredAt.toISOString().slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + (payload.amountMinor ?? 0));
    }
    return Array.from(byMonth.entries()).map(([aggregateKey, value]) => ({ aggregateKey, value: { totalMinor: value, count: events.filter(e => e.occurredAt.toISOString().slice(0, 7) === aggregateKey).length } }));
  },
};

// Built-in projection: worker job completion count
const workerCompletionProjection: ProjectionBuilder = {
  name: "worker_completion_count",
  handles: (et) => et === "booking.completed",
  build: async (events) => {
    const byWorker = new Map<string, number>();
    for (const e of events) {
      const payload = JSON.parse(e.payloadJson) as { workerId?: string };
      if (payload.workerId) {
        byWorker.set(payload.workerId, (byWorker.get(payload.workerId) ?? 0) + 1);
      }
    }
    return Array.from(byWorker.entries()).map(([aggregateKey, value]) => ({ aggregateKey, value: { completedJobs: value } }));
  },
};

const BUILTIN_PROJECTIONS: ProjectionBuilder[] = [monthlyRevenueProjection, workerCompletionProjection];

export async function rebuildProjection(projectionName: string, since?: Date) {
  const builder = BUILTIN_PROJECTIONS.find((p) => p.name === projectionName);
  if (!builder) throw badRequest(`Unknown projection: ${projectionName}`);

  // Find the last event we processed
  const lastProjection = await db.analyticsProjection.findFirst({
    where: { projectionName },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch events since the last processed one
  const events = await db.analyticsEvent.findMany({
    where: {
      occurredAt: { gte: since ?? lastProjection?.computedAt ?? new Date(0) },
    },
    orderBy: { occurredAt: "asc" },
    take: 10000,
  });

  const filtered = events.filter((e) => builder.handles(e.eventType));
  const results = await builder.build(filtered);

  let upserted = 0;
  for (const r of results) {
    await db.analyticsProjection.upsert({
      where: { projectionName_aggregateKey: { projectionName, aggregateKey: r.aggregateKey } },
      update: {
        valueJson: JSON.stringify(r.value),
        lastEventId: filtered[filtered.length - 1]?.id,
        lastEventVersion: filtered[filtered.length - 1]?.version,
        updatedAt: new Date(),
      },
      create: {
        projectionName,
        aggregateKey: r.aggregateKey,
        valueJson: JSON.stringify(r.value),
        lastEventId: filtered[filtered.length - 1]?.id,
        lastEventVersion: filtered[filtered.length - 1]?.version,
      },
    });
    upserted++;
  }

  return { projectionName, processed: filtered.length, upserted };
}

export async function readProjection(projectionName: string, aggregateKey?: string) {
  if (aggregateKey) {
    const p = await db.analyticsProjection.findUnique({
      where: { projectionName_aggregateKey: { projectionName, aggregateKey } },
    });
    return p ? { ...p, value: JSON.parse(p.valueJson) } : null;
  }
  const items = await db.analyticsProjection.findMany({
    where: { projectionName },
    orderBy: { aggregateKey: "asc" },
  });
  return items.map((p) => ({ ...p, value: JSON.parse(p.valueJson) }));
}

// ---------------------------------------------------------------------------
//  Saved queries — reusable analytics definitions
// ---------------------------------------------------------------------------

export async function saveQuery(input: {
  name: string;
  description?: string;
  queryType: string;
  dataSource: string;
  config: Record<string, unknown>;
  isPublic?: boolean;
  createdBy?: string;
}) {
  return db.analyticsQuery.create({
    data: {
      name: input.name,
      description: input.description,
      queryType: input.queryType,
      dataSource: input.dataSource,
      configJson: JSON.stringify(input.config),
      isPublic: input.isPublic ?? false,
      createdBy: input.createdBy,
    },
  });
}

export async function runQuery(queryId: string, runBy?: string) {
  const query = await db.analyticsQuery.findUnique({ where: { id: queryId } });
  if (!query) throw notFound("Query not found");
  const config = JSON.parse(query.configJson) as Record<string, unknown>;
  const start = Date.now();

  // Simple execution: if dataSource is ANALYTICS_EVENT, scan events by eventType filter
  let result: unknown[] = [];
  if (query.dataSource === "ANALYTICS_EVENT") {
    const events = await db.analyticsEvent.findMany({
      where: config.eventType ? { eventType: config.eventType as string } : {},
      orderBy: { occurredAt: "desc" },
      take: (config.limit as number) ?? 100,
    });
    result = events;
  } else if (query.dataSource === "PROJECTION") {
    const projections = await db.analyticsProjection.findMany({
      where: config.projectionName ? { projectionName: config.projectionName as string } : {},
    });
    result = projections;
  }

  const durationMs = Date.now() - start;
  const run = await db.analyticsQueryRun.create({
    data: {
      queryId,
      queryConfigJson: query.configJson,
      resultJson: JSON.stringify(result),
      rowcount: result.length,
      durationMs,
      runBy,
    },
  });

  return { run, result, durationMs };
}

// ---------------------------------------------------------------------------
//  Analytics dashboard metrics
// ---------------------------------------------------------------------------

export async function eventSourcedMetrics() {
  const [totalEvents, projectionsCount, queriesCount, recentEvents] = await Promise.all([
    db.analyticsEvent.count(),
    db.analyticsProjection.count(),
    db.analyticsQuery.count(),
    db.analyticsEvent.findMany({
      orderBy: { occurredAt: "desc" },
      take: 5,
      select: { id: true, aggregateType: true, eventType: true, occurredAt: true },
    }),
  ]);
  return {
    totalEvents,
    projectionsCount,
    queriesCount,
    recentEvents,
  };
}
