/**
 * ============================================================================
 *  Eks-Clean — Rate Limiter (token bucket, DB-backed)
 * ============================================================================
 *  - Buckets persist in DB so they survive restarts and work across instances.
 *  - For very hot paths (login, OTP), an in-process LRU can layer on top.
 *  - This is intentionally simple; swap for `@nestjs/throttler` or Redis
 *    rate-limiter in production.
 * ============================================================================
 */

import { db } from "@/lib/db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function consume(
  bucketKey: string,
  maxTokens: number,
  refillPerSec: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const row = await db.rateLimitBucket.upsert({
    where: { bucketKey },
    update: {},
    create: {
      bucketKey,
      tokens: maxTokens,
      maxTokens,
      refillPerSec,
      lastRefillAt: new Date(now),
    },
  });

  // Refill
  const elapsedSec = (now - row.lastRefillAt.getTime()) / 1000;
  const refilled = Math.min(
    row.maxTokens,
    row.tokens + Math.floor(elapsedSec * row.refillPerSec),
  );

  if (refilled <= 0) {
    const retryAfterMs = Math.ceil((1 - refilled / row.refillPerSec) * 1000);
    await db.rateLimitBucket.update({
      where: { bucketKey },
      data: { tokens: refilled, lastRefillAt: new Date(now) },
    });
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 1000) };
  }

  const newTokens = refilled - 1;
  await db.rateLimitBucket.update({
    where: { bucketKey },
    data: { tokens: newTokens, lastRefillAt: new Date(now) },
  });
  return { allowed: true, remaining: newTokens, retryAfterMs: 0 };
}

export const LIMITS = {
  LOGIN: { max: 10, refillPerSec: 1 },
  OTP: { max: 5, refillPerSec: 1 },
  API_WRITE: { max: 60, refillPerSec: 5 },
} as const;
