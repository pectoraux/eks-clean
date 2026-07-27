// OpsOS Health
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const maxDuration = 60;

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.db = { status: "ok", latencyMs: Date.now() - start };
  } catch (e) {
    checks.db = { status: "fail" };
  }
  const allOk = checks.db?.status === "ok";
  return NextResponse.json({ status: allOk ? "ok" : "degraded", service: "opsos", version: "1.0.0", checks }, { status: allOk ? 200 : 503 });
}
