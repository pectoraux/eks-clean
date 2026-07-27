/**
 * ============================================================================
 *  OpsOS Projection Engine — CQRS Read Side
 * ============================================================================
 *  Projections are materialized views rebuilt from events.
 *  The source of truth is always the event log.
 * ============================================================================
 */

import { db } from "@/lib/db";

export interface ProjectionBuilder {
  name: string;
  handles: (eventType: string) => boolean;
  build: (events: Array<{ aggregateId: string; eventType: string; payloadJson: string; occurredAt: Date }>) => Promise<Array<{ aggregateKey: string; value: unknown }>>;
}

const builders = new Map<string, ProjectionBuilder>();

export function registerProjectionBuilder(builder: ProjectionBuilder): void {
  builders.set(builder.name, builder);
}

export async function rebuildProjection(
  organizationId: string,
  projectionName: string,
  since?: Date,
): Promise<{ processed: number; upserted: number }> {
  const builder = builders.get(projectionName);
  if (!builder) {
    // Generic projection: just count events by type
    return rebuildGenericProjection(organizationId, projectionName, since);
  }

  const events = await db.event.findMany({
    where: {
      organizationId,
      occurredAt: { gte: since ?? new Date(0) },
    },
    orderBy: { occurredAt: "asc" },
    take: 10000,
  });

  const filtered = events.filter((e) => builder.handles(e.eventType));
  const results = await builder.build(filtered);

  for (const r of results) {
    await db.projection.upsert({
      where: { organizationId_projectionName_aggregateKey: { organizationId, projectionName, aggregateKey: r.aggregateKey } },
      update: { valueJson: JSON.stringify(r.value), updatedAt: new Date() },
      create: { organizationId, projectionName, aggregateKey: r.aggregateKey, valueJson: JSON.stringify(r.value) },
    });
  }

  return { processed: filtered.length, upserted: results.length };
}

async function rebuildGenericProjection(organizationId: string, projectionName: string, since?: Date) {
  const events = await db.event.findMany({
    where: { organizationId, occurredAt: { gte: since ?? new Date(0) } },
    orderBy: { occurredAt: "asc" },
    take: 10000,
  });

  // Group by aggregate type
  const byType = new Map<string, { count: number; lastEvent: string }>();
  for (const e of events) {
    const key = e.aggregateType;
    const existing = byType.get(key) ?? { count: 0, lastEvent: "" };
    existing.count++;
    existing.lastEvent = e.eventType;
    byType.set(key, existing);
  }

  for (const [key, value] of byType) {
    await db.projection.upsert({
      where: { organizationId_projectionName_aggregateKey: { organizationId, projectionName, aggregateKey: key } },
      update: { valueJson: JSON.stringify(value), updatedAt: new Date() },
      create: { organizationId, projectionName, aggregateKey: key, valueJson: JSON.stringify(value) },
    });
  }

  return { processed: events.length, upserted: byType.size };
}

export async function readProjection(organizationId: string, projectionName: string, aggregateKey?: string) {
  if (aggregateKey) {
    const p = await db.projection.findUnique({
      where: { organizationId_projectionName_aggregateKey: { organizationId, projectionName, aggregateKey } },
    });
    return p ? { ...p, value: JSON.parse(p.valueJson) } : null;
  }
  const items = await db.projection.findMany({
    where: { organizationId, projectionName },
    orderBy: { aggregateKey: "asc" },
  });
  return items.map((p) => ({ ...p, value: JSON.parse(p.valueJson) }));
}
