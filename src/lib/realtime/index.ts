/**
 * ============================================================================
 *  Eks-Clean — Realtime fanout (socket.io bridge)
 * ============================================================================
 *  - The actual socket.io server runs as a mini-service (port 3001).
 *  - This module posts events to it via internal HTTP when the Next.js API
 *    needs to push an update to a connected client (e.g. booking status change).
 *  - In dev/preview, falls back to no-op if the mini-service isn't running.
 * ============================================================================
 */

const REALTIME_URL = process.env.REALTIME_INTERNAL_URL || "http://127.0.0.1:3001";

export async function broadcast(channel: string, event: string, payload: unknown): Promise<void> {
  try {
    await fetch(`${REALTIME_URL}/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, event, payload }),
      // Fire-and-forget: don't block the API call if the realtime service is down.
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // swallow — realtime is best-effort in this environment
  }
}

export const CHANNELS = {
  booking: (bookingId: string) => `booking:${bookingId}`,
  worker: (workerId: string) => `worker:${workerId}`,
  customer: (customerId: string) => `customer:${customerId}`,
  adminOps: () => `admin:ops`,
} as const;
