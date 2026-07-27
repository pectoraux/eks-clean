/**
 * Eks-Clean protocol API: book a cleaning service
 * Creates a Demand in the OpsOS kernel (domain-independent) with the
 * capability code and constraints from the Eks-Clean protocol
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { createDemand, createIntent, validateIntent, evaluatePolicy, resolveCapabilities, allocateResources, createExecutionPlan } from "@/lib/kernel/intent";
import { z } from "zod";

export const maxDuration = 60;

const bookSchema = z.object({
  organizationId: z.string(),
  capabilityCode: z.string(),
  intentKey: z.string(),
  parameters: z.record(z.string(), z.any()),
  priority: z.string().default("NORMAL"),
  customerId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const body = await parseJson(req, bookSchema);

    // 1. Create demand (kernel primitive — domain-independent)
    const demand = await createDemand(body.organizationId, {
      source: "EXTERNAL",
      capabilityCode: body.capabilityCode,
      quantity: 1,
      constraints: body.parameters,
      customerId: body.customerId,
      priority: body.priority,
    });

    // 2. Create intent (kernel compiles the demand into an intent)
    const intent = await createIntent(body.organizationId, demand.id, {
      intentKey: body.intentKey,
      parameters: body.parameters,
      protocolId: "eks-clean",
    });

    // 3. Validate intent
    await validateIntent(intent.id);

    // 4. Evaluate policy
    await evaluatePolicy(intent.id);

    // 5. Resolve capabilities
    await resolveCapabilities(intent.id);

    // 6. Allocate resources
    await allocateResources(intent.id);

    // 7. Create execution plan
    const plan = await createExecutionPlan(intent.id);

    return {
      booked: true,
      demand: { id: demand.id, code: demand.code, status: demand.status },
      intent: { id: intent.id, code: intent.code, validationStatus: intent.validationStatus },
      executionPlan: { id: plan.id, code: plan.code, status: plan.status },
    };
  });
}
