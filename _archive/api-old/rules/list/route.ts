import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createRule, listRules, ruleMetrics, evaluateRulesForEvent } from "@/lib/modules/rules-engine/service";
import { z } from "zod";

const conditionSchema = z.object({ field: z.string(), operator: z.string(), value: z.unknown(), logicOperator: z.string().default("AND") });
const actionSchema = z.object({ actionType: z.string(), name: z.string().optional(), config: z.record(z.string(), z.any()), isAsync: z.boolean().default(false) });
const ruleSchema = z.object({
  organizationId: z.string(), name: z.string(), description: z.string().optional(),
  triggerEvent: z.string(), triggerType: z.string().default("EVENT"), scope: z.string().default("ORGANIZATION"),
  scopeId: z.string().optional(), priority: z.number().int().default(100), isActive: z.boolean().default(true),
  conditions: z.array(conditionSchema), actions: z.array(actionSchema),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "rules:read" as never);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (url.searchParams.get("metrics") === "true" && orgId) return ruleMetrics(orgId);
    if (!orgId) return { items: [] };
    return { items: await listRules(orgId, url.searchParams.get("triggerEvent") || undefined) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "evaluate") {
      requirePerm(session as never, "rules:execute" as never);
      const body = await parseJson(req, z.object({ organizationId: z.string(), triggerEvent: z.string(), context: z.record(z.string(), z.any()) }));
      return { results: await evaluateRulesForEvent(body.organizationId, body.triggerEvent, body.context) };
    }
    requirePerm(session as never, "rules:manage" as never);
    const body = await parseJson(req, ruleSchema);
    return { rule: await createRule({ ...body, createdBy: session?.sub }) };
  });
}
