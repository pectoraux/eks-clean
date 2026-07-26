/**
 * ============================================================================
 *  Eks-Clean — Feature Flags
 * ============================================================================
 *  - DB-backed; cached in-memory for 15 seconds to avoid hot-path DB hits.
 *  - Supports percentage rollouts and role targeting.
 *  - Use this to gate marketplace, AI assistants, new cleaning services, etc.
 * ============================================================================
 */

import { db } from "@/lib/db";
import type { Role } from "@/lib/types";

interface CachedFlag {
  value: { enabled: boolean; rolloutPercent: number; targetRoles: string[] | null };
  cachedAt: number;
}

const TTL_MS = 15_000;
const cache = new Map<string, CachedFlag>();

export async function isFeatureEnabled(
  key: string,
  ctx?: { userId?: string; role?: Role },
): Promise<boolean> {
  const now = Date.now();
  let c = cache.get(key);
  if (!c || now - c.cachedAt > TTL_MS) {
    const row = await db.featureFlag.findUnique({ where: { key } });
    c = {
      value: {
        enabled: row?.enabled ?? false,
        rolloutPercent: row?.rolloutPercent ?? 0,
        targetRoles: row?.targetRoles ? row.targetRoles.split(",") : null,
      },
      cachedAt: now,
    };
    cache.set(key, c);
  }
  const { enabled, rolloutPercent, targetRoles } = c.value;
  if (!enabled) return false;
  if (targetRoles && ctx?.role && !targetRoles.includes(ctx.role)) return false;
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;
  // Deterministic bucket by userId (or random if anon)
  const bucket = ctx?.userId
    ? hashBucket(ctx.userId)
    : Math.floor(Math.random() * 100);
  return bucket < rolloutPercent;
}

function hashBucket(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 100;
}

export async function refreshCache(): Promise<void> {
  cache.clear();
}

// Well-known flag keys used across the app.
export const FLAGS = {
  MARKETPLACE_OPEN: "marketplace.open",
  AI_DEMAND_FORECAST: "ai.demand_forecast",
  AI_DISPATCH_OPTIMIZER: "ai.dispatch_optimizer",
  AI_QA_PREDICTION: "ai.qa_prediction",
  AI_SUPPORT_ASSISTANT: "ai.support_assistant",
  LAUNDRY_MODULE: "module.laundry",
  WASTE_MODULE: "module.waste",
} as const;
