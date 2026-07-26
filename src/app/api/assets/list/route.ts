import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createAsset, assetMetrics, getAssetHierarchy, scheduleMaintenance, completeMaintenance } from "@/lib/modules/asset-registry/service";
import { z } from "zod";

const schema = z.object({
  organizationId: z.string(), parentAssetId: z.string().optional(), code: z.string(), name: z.string(),
  assetType: z.string(), description: z.string().optional(), propertyId: z.string().optional(), location: z.string().optional(),
  serialNumber: z.string().optional(), manufacturer: z.string().optional(), model: z.string().optional(),
  yearAcquired: z.number().int().optional(), purchaseCostMinor: z.number().int().optional(),
  maintenanceIntervalDays: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "assets:read" as never);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (url.searchParams.get("metrics") === "true" && orgId) return assetMetrics(orgId);
    const items = await db.asset.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: { parent: { select: { name: true, code: true } }, _count: { select: { children: true, maintenanceRecords: true } } },
      orderBy: { createdAt: "desc" }, take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "assets:manage" as never);
    const body = await parseJson(req, schema);
    return { asset: await createAsset(body) };
  });
}
