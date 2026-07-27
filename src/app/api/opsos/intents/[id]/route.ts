// OpsOS Intent lifecycle: validate → policy → resolve → allocate → plan
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle } from "@/lib/utils/api";
import { validateIntent, evaluatePolicy, resolveCapabilities, allocateResources, createExecutionPlan } from "@/lib/kernel/intent";

export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "validate") return validateIntent(id);
    if (action === "policy") return evaluatePolicy(id);
    if (action === "resolve") return resolveCapabilities(id);
    if (action === "allocate") return allocateResources(id);
    if (action === "plan") return { plan: await createExecutionPlan(id) };
    return { error: "Unknown action" };
  });
}
