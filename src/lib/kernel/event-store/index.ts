/**
 * ============================================================================
 *  OpsOS Event Store — CQRS Write Side
 * ============================================================================
 *  - Events are immutable (append-only)
 *  - State exists only as projections
 *  - Every write creates events
 *  - Version is monotonic per aggregate
 * ============================================================================
 */

import { db } from "@/lib/db";
import type { RuntimeClock } from "./clock";

export interface DomainEvent {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata?: {
    actorId?: string;
    actorType?: string;
    correlationId?: string;
    causationId?: string;
    clockTick?: string;
  };
}

export async function appendEvent(
  organizationId: string,
  event: DomainEvent,
  clock?: RuntimeClock,
): Promise<{ id: string; version: number }> {
  // Find current max version for this aggregate
  const lastEvent = await db.event.findFirst({
    where: { organizationId, aggregateType: event.aggregateType, aggregateId: event.aggregateId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastEvent?.version ?? 0) + 1;

  const created = await db.event.create({
    data: {
      organizationId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      version: nextVersion,
      payloadJson: JSON.stringify(event.payload),
      metadataJson: JSON.stringify({
        ...event.metadata,
        clockTick: clock?.tick().toString(),
      }),
    },
  });

  return { id: created.id, version: nextVersion };
}

export async function getAggregateHistory(
  organizationId: string,
  aggregateType: string,
  aggregateId: string,
) {
  return db.event.findMany({
    where: { organizationId, aggregateType, aggregateId },
    orderBy: { version: "asc" },
  });
}

export async function getEvents(
  organizationId: string,
  filter: {
    aggregateType?: string;
    eventType?: string;
    since?: Date;
    until?: Date;
    limit?: number;
  } = {},
) {
  return db.event.findMany({
    where: {
      organizationId,
      ...(filter.aggregateType ? { aggregateType: filter.aggregateType } : {}),
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
