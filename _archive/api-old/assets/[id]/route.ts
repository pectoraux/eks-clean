import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { getAssetHierarchy, scheduleMaintenance, completeMaintenance } from "@/lib/modules/asset-registry/service";
import { z } from "zod";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "assets:read" as never);
    const { id } = await ctx.params;
    return { asset: await getAssetHierarchy(id) };
  });
}

const maintenanceSchema = z.object({ maintenanceType: z.string().default("PREVENTIVE"), scheduledAt: z.string().optional(), description: z.string().optional(), costMinor: z.number().int().optional() });
const completeSchema = z.object({ findings: z.string().optional(), partsReplaced: z.array(z.string()).optional(), costMinor: z.number().int().optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "assets:manage" as never);
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "maintenance";
    if (action === "maintenance") {
      const body = await parseJson(req, maintenanceSchema);
      return { maintenance: await scheduleMaintenance(id, { ...body, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined }) };
    }
    return { error: "Unknown action" };
  });
}
