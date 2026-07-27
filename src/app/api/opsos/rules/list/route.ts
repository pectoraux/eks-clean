// OpsOS Rules — list + create + evaluate
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { createRule, listRules, evaluateRulesForEvent } from "@/lib/kernel/rules";
import { z } from "zod";

export const maxDuration = 60;

const ruleSchema = z.object({
  organizationId: z.string(), name: z.string(), description: z.string().optional(),
  triggerEvent: z.string(), triggerType: z.string().default("EVENT"), priority: z.number().default(100),
  conditions: z.array(z.object({ field: z.string(), operator: z.string(), value: z.any(), logicOperator: z.string().default("AND") })),
  actions: z.array(z.object({ actionType: z.string(), config: z.record(z.string(), z.any()), isAsync: z.boolean().default(false) })),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (!orgId) return { items: [] };
    return { items: await listRules(orgId, url.searchParams.get("triggerEvent") || undefined) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "evaluate") {
      const body = await parseJson(req, z.object({ organizationId: z.string(), triggerEvent: z.string(), context: z.record(z.string(), z.any()) }));
      return { results: await evaluateRulesForEvent(body.organizationId, body.triggerEvent, body.context) };
    }
    const body = await parseJson(req, ruleSchema);
    return { rule: await createRule(body.organizationId, body) };
  });
}
