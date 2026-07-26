/**
 * Asset Registry — buildings, equipment, vehicles with maintenance history
 */
import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict } from "@/lib/utils/api";

export async function createAsset(input: {
  organizationId: string; parentAssetId?: string; code: string; name: string;
  assetType: string; description?: string; propertyId?: string; location?: string;
  serialNumber?: string; manufacturer?: string; model?: string; yearAcquired?: number;
  purchaseCostMinor?: number; maintenanceIntervalDays?: number; warrantyExpiry?: Date;
  metadataJson?: Record<string, unknown>;
}) {
  const existing = await db.asset.findUnique({ where: { organizationId_code: { organizationId: input.organizationId, code: input.code } } });
  if (existing) throw conflict(`Asset ${input.code} already exists`);
  const asset = await db.asset.create({
    data: { ...input, metadataJson: input.metadataJson ? JSON.stringify(input.metadataJson) : null },
  });
  await publish({ eventType: "asset.created", payload: { assetId: asset.id, code: input.code, type: input.assetType } });
  return asset;
}

export async function getAssetHierarchy(assetId: string) {
  const asset = await db.asset.findUnique({
    where: { id: assetId },
    include: {
      parent: true,
      children: { include: { _count: { select: { children: true, maintenanceRecords: true } } } },
      maintenanceRecords: { orderBy: { completedAt: "desc" }, take: 10 },
      _count: { select: { children: true, maintenanceRecords: true, workOrderLinks: true } },
    },
  });
  if (!asset) throw notFound("Asset not found");
  return asset;
}

export async function scheduleMaintenance(assetId: string, input: {
  maintenanceType?: string; scheduledAt?: Date; description?: string; costMinor?: number;
}) {
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw notFound("Asset not found");
  const maint = await db.assetMaintenance.create({ data: { assetId, ...input, status: "SCHEDULED" } });
  await publish({ eventType: "asset.maintenance_scheduled", payload: { assetId, maintenanceId: maint.id } });
  return maint;
}

export async function completeMaintenance(maintenanceId: string, input: {
  performedBy?: string; findings?: string; partsReplaced?: string[]; costMinor?: number;
}) {
  const maint = await db.assetMaintenance.findUnique({ where: { id: maintenanceId } });
  if (!maint) throw notFound("Maintenance record not found");
  const updated = await db.assetMaintenance.update({
    where: { id: maintenanceId },
    data: {
      status: "COMPLETED", completedAt: new Date(), performedBy: input.performedBy,
      findings: input.findings, partsReplaced: input.partsReplaced ? JSON.stringify(input.partsReplaced) : null,
      costMinor: input.costMinor ?? maint.costMinor,
    },
  });
  // Update asset's lastMaintenanceAt + nextMaintenanceAt
  const asset = await db.asset.findUnique({ where: { id: maint.assetId } });
  if (asset && asset.maintenanceIntervalDays) {
    const next = new Date(Date.now() + asset.maintenanceIntervalDays * 24 * 60 * 60 * 1000);
    await db.asset.update({ where: { id: asset.id }, data: { lastMaintenanceAt: new Date(), nextMaintenanceAt: next } });
  }
  return updated;
}

export async function assetMetrics(organizationId: string) {
  const [total, byType, underMaintenance, overdueMaintenance, totalValue] = await Promise.all([
    db.asset.count({ where: { organizationId } }),
    db.asset.groupBy({ by: ["assetType"], where: { organizationId }, _count: true }),
    db.asset.count({ where: { organizationId, status: "UNDER_MAINTENANCE" } }),
    db.asset.count({ where: { organizationId, nextMaintenanceAt: { lt: new Date() } } }),
    db.asset.aggregate({ where: { organizationId }, _sum: { currentValueMinor: true } }),
  ]);
  return { total, byType, underMaintenance, overdueMaintenance, totalValueMinor: totalValue._sum.currentValueMinor ?? 0 };
}
