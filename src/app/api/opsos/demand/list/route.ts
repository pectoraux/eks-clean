// OpsOS Demand — list + create + lifecycle (intent → plan → execute → complete)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { createDemand, createIntent, validateIntent, evaluatePolicy, resolveCapabilities, allocateResources, createExecutionPlan, executePlan, completePlan } from "@/lib/kernel/intent";
import { z } from "zod";

export const maxDuration = 60;

const demandSchema = z.object({
  organizationId: z.string(), capabilityCode: z.string().optional(), quantity: z.number().default(1),
  constraints: z.record(z.string(), z.any()).optional(), customerId: z.string().optional(),
  priority: z.string().default("NORMAL"), source: z.string().default("EXTERNAL"),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    const items = await db.demand.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: { intent: true, executionPlan: true },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const body = await parseJson(req, demandSchema);
    return { demand: await createDemand(body.organizationId, body) };
  });
}
