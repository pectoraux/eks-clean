// Health check endpoint
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  // DB
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.db = { status: "ok", latencyMs: Date.now() - start };
  } catch (e) {
    checks.db = { status: "fail", error: e instanceof Error ? e.message : "unknown" };
  }
  // Payment gateway (mock mode is always "ok")
  checks.payswap = { status: process.env.PAYS_SWAP_API_KEY ? "live" : "mock" };
  // Realtime service (best-effort) — internal HTTP API is on port 3002
  try {
    const start = Date.now();
    const realtimeUrl = process.env.REALTIME_INTERNAL_URL || "http://127.0.0.1:3002";
    const r = await fetch(`${realtimeUrl}/health`, { signal: AbortSignal.timeout(500) });
    checks.realtime = { status: r.ok ? "ok" : "degraded", latencyMs: Date.now() - start };
  } catch {
    checks.realtime = { status: "degraded", error: "service not reachable" };
  }

  const allOk = checks.db.status === "ok";
  return NextResponse.json({
    status: allOk ? "ok" : "degraded",
    service: "eks-clean",
    version: "1.0.0",
    time: new Date().toISOString(),
    checks,
  }, { status: allOk ? 200 : 503 });
}
