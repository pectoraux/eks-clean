import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { transitionWorkOrder, addInspection, addSignOff } from "@/lib/modules/work-orders/service";
import { z } from "zod";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "workorders:read" as never);
    const { id } = await ctx.params;
    const wo = await db.workOrder.findUnique({
      where: { id },
      include: { tasks: { orderBy: { order: "asc" } }, inspections: { orderBy: { inspectedAt: "desc" } }, signOffs: true, statusHistory: { orderBy: { createdAt: "asc" } }, assets: { include: { asset: true } } },
    });
    if (!wo) throw notFound("Work order not found");
    return { workOrder: wo };
  });
}

const transitionSchema = z.object({ toStatus: z.string(), reason: z.string().optional() });
const inspectionSchema = z.object({ inspectionType: z.string().default("QUALITY"), score: z.number().optional(), passed: z.boolean().default(true), findings: z.string().optional(), nextAction: z.string().optional() });
const signOffSchema = z.object({ signerRole: z.string(), comments: z.string().optional(), approved: z.boolean().default(true) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "transition";
    if (action === "transition") {
      requirePerm(session as never, "workorders:manage" as never);
      const body = await parseJson(req, transitionSchema);
      return { workOrder: await transitionWorkOrder(id, body.toStatus, { id: session?.sub, type: session?.role }, body.reason) };
    }
    if (action === "inspection") {
      requirePerm(session as never, "workorders:inspect" as never);
      const body = await parseJson(req, inspectionSchema);
      return { inspection: await addInspection(id, { ...body, inspectedBy: session?.sub }) };
    }
    if (action === "signoff") {
      requirePerm(session as never, "workorders:manage" as never);
      const body = await parseJson(req, signOffSchema);
      return { signOff: await addSignOff(id, { ...body, signedBy: session!.sub }) };
    }
    return { error: "Unknown action" };
  });
}
