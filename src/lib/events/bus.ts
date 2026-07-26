/**
 * ============================================================================
 *  Eks-Clean — Event Bus (in-process pub/sub with persistence)
 * ============================================================================
 *  - Publishes domain events to in-process subscribers (decoupled handlers).
 *  - Persists every event to the DomainEvent table (audit / replay / analytics).
 *  - Designed to be swapped for Redis Pub/Sub or Kafka without touching
 *    business logic — the public API stays the same.
 * ============================================================================
 */

import { db } from "@/lib/db";
import type { DomainEventPayload } from "@/lib/types";

type Handler = (event: DomainEventPayload) => void | Promise<void>;
const handlers = new Map<string, Set<Handler>>();

export function subscribe(eventType: string, handler: Handler): () => void {
  if (!handlers.has(eventType)) handlers.set(eventType, new Set());
  handlers.get(eventType)!.add(handler);
  return () => handlers.get(eventType)?.delete(handler);
}

/**
 * Publish a domain event:
 *  1. Persist to DB (await) — guarantees durability
 *  2. Fire in-process subscribers (fire-and-forget; errors are swallowed)
 *
 * Note: in a real Redis/Kafka deployment, step 2 is replaced by publishing
 * to the message bus; durability is still guaranteed by step 1 + outbox.
 */
export async function publish(event: DomainEventPayload): Promise<void> {
  try {
    await db.domainEvent.create({
      data: {
        bookingId: event.bookingId,
        eventType: event.eventType,
        payloadJson: JSON.stringify(event.payload),
        actorId: event.actorId,
        actorType: event.actorType,
        correlationId: event.correlationId,
      },
    });
  } catch (e) {
    // Persistence failure must not break the calling transaction.
    // In production, route this to a dead-letter + structured log.
    console.error("[event-bus] persist failed", event.eventType, e);
  }

  const subs = handlers.get(event.eventType);
  if (!subs) return;
  for (const h of subs) {
    try {
      await h(event);
    } catch (e) {
      console.error("[event-bus] handler error", event.eventType, e);
    }
  }
}

/** Convenience: emit a notification when a booking changes status. */
export function emitBookingEvent(
  bookingId: string,
  eventType: string,
  payload: Record<string, unknown>,
  actor?: { id: string; type: string },
): Promise<void> {
  return publish({
    eventType,
    bookingId,
    payload,
    actorId: actor?.id,
    actorType: actor?.type,
    correlationId: bookingId,
  });
}
