/**
 * Work Orders — generic work engine (cleaning, maintenance, repairs, inspections)
 */
import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

const STATUS_FLOW: Record<string, string[]> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED", "OPEN"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "FAILED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: ["IN_PROGRESS"],
};

export async function createWorkOrder(input: {
  organizationId: string; title: string; description?: string; workOrderType?: string;
  priority?: string; customerId?: string; propertyId?: string; bookingId?: string;
  enterpriseId?: string; costCenterId?: string; assetId?: string; workflowV2Id?: string;
  scheduledStart?: Date; scheduledEnd?: Date; estimatedCostMinor?: number;
}) {
  const code = `WO-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
  const wo = await db.workOrder.create({ data: { ...input, code } });
  await db.workOrderStatusHistory.create({ data: { workOrderId: wo.id, toStatus: "OPEN", changedByType: "SYSTEM" } });
  await publish({ eventType: "workorder.created", payload: { workOrderId: wo.id, code, type: input.workOrderType } });
  return wo;
}

export async function transitionWorkOrder(workOrderId: string, toStatus: string, actor: { id?: string; type?: string }, reason?: string) {
  const wo = await db.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw notFound("Work order not found");
  const allowed = STATUS_FLOW[wo.status] ?? [];
  if (!allowed.includes(toStatus)) throw conflict(`Cannot transition from ${wo.status} to ${toStatus}`);

  const update: Record<string, unknown> = { status: toStatus };
  if (toStatus === "IN_PROGRESS") update.actualStart = new Date();
  if (toStatus === "COMPLETED") update.actualEnd = new Date();

  const updated = await db.workOrder.update({ where: { id: workOrderId }, data: update });
  await db.workOrderStatusHistory.create({ data: { workOrderId, fromStatus: wo.status, toStatus, changedBy: actor.id, changedByType: actor.type, reason } });
  await publish({ eventType: "workorder.status_changed", payload: { workOrderId, from: wo.status, to: toStatus } });
  return updated;
}

export async function addInspection(workOrderId: string, input: {
  inspectedBy?: string; inspectionType?: string; score?: number; passed?: boolean;
  findings?: string; deficiencies?: Array<{ area: string; severity: string; description: string }>;
  photoUrls?: string[]; nextAction?: string;
}) {
  const insp = await db.workOrderInspection.create({
    data: {
      workOrderId, inspectedBy: input.inspectedBy,
      inspectionType: input.inspectionType ?? "QUALITY",
      score: input.score, passed: input.passed ?? true,
      findings: input.findings,
      deficienciesJson: input.deficiencies ? JSON.stringify(input.deficiencies) : null,
      photoUrls: input.photoUrls ? JSON.stringify(input.photoUrls) : null,
      nextAction: input.nextAction,
    },
  });
  await publish({ eventType: "workorder.inspection_added", payload: { workOrderId, inspectionId: insp.id, passed: insp.passed } });
  return insp;
}

export async function addSignOff(workOrderId: string, input: { signedBy: string; signerRole: string; comments?: string; approved?: boolean }) {
  return db.workOrderSignOff.create({ data: { workOrderId, ...input, approved: input.approved ?? true } });
}

export async function workOrderMetrics(organizationId: string) {
  const [total, open, inProgress, completed, failed, inspections, avgScore] = await Promise.all([
    db.workOrder.count({ where: { organizationId } }),
    db.workOrder.count({ where: { organizationId, status: "OPEN" } }),
    db.workOrder.count({ where: { organizationId, status: "IN_PROGRESS" } }),
    db.workOrder.count({ where: { organizationId, status: "COMPLETED" } }),
    db.workOrder.count({ where: { organizationId, status: "FAILED" } }),
    db.workOrderInspection.count({ where: { workOrder: { organizationId } } }),
    db.workOrderInspection.aggregate({ where: { workOrder: { organizationId } }, _avg: { score: true } }),
  ]);
  return { total, open, inProgress, completed, failed, inspections, avgInspectionScore: avgScore._avg.score ?? 0 };
}
