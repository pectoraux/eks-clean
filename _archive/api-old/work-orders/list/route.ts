import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createWorkOrder, transitionWorkOrder, addInspection, addSignOff, workOrderMetrics } from "@/lib/modules/work-orders/service";
import { z } from "zod";

const createSchema = z.object({
  organizationId: z.string(), title: z.string(), description: z.string().optional(),
  workOrderType: z.string().default("CLEANING"), priority: z.string().default("NORMAL"),
  customerId: z.string().optional(), propertyId: z.string().optional(), bookingId: z.string().optional(),
  enterpriseId: z.string().optional(), costCenterId: z.string().optional(), assetId: z.string().optional(),
  scheduledStart: z.string().optional(), scheduledEnd: z.string().optional(), estimatedCostMinor: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "workorders:read" as never);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (url.searchParams.get("metrics") === "true" && orgId) return workOrderMetrics(orgId);
    const items = await db.workOrder.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: { _count: { select: { tasks: true, inspections: true, signOffs: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "workorders:manage" as never);
    const body = await parseJson(req, createSchema);
    return { workOrder: await createWorkOrder({
      ...body,
      scheduledStart: body.scheduledStart ? new Date(body.scheduledStart) : undefined,
      scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : undefined,
    }) };
  });
}
