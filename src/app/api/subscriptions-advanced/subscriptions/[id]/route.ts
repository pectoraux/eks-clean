// Subscription lifecycle: usage, change-plan, dunning, pause
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { recordUsage, changePlan, startDunning, resolveDunning, schedulePause, autoResumeExpiredPauses } from "@/lib/modules/subscriptions-advanced/service";
import { z } from "zod";

const usageSchema = z.object({ units: z.number().int().min(1) });
const changePlanSchema = z.object({ newPlanId: z.string() });
const pauseSchema = z.object({ startDate: z.string(), endDate: z.string().optional(), reason: z.string().optional(), autoResume: z.boolean().default(true) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "subscriptions:manage");
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "usage";

    if (action === "usage") {
      const body = await parseJson(req, usageSchema);
      return recordUsage(id, body.units);
    }
    if (action === "change-plan") {
      const body = await parseJson(req, changePlanSchema);
      return changePlan(id, body.newPlanId, { id: session?.sub, type: session?.role });
    }
    if (action === "pause") {
      const body = await parseJson(req, pauseSchema);
      return schedulePause(id, new Date(body.startDate), body.endDate ? new Date(body.endDate) : undefined, body.reason, body.autoResume);
    }
    if (action === "resume-paused") {
      return autoResumeExpiredPauses();
    }
    return { error: "Unknown action" };
  });
}
