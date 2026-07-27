import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { scheduleMaintenance, completeMaintenance } from "@/lib/modules/fleet/service";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["schedule", "complete"]),
  type: z.string().optional(),
  description: z.string().optional(),
  scheduledAt: z.string().optional(),
  odometerKm: z.number().int().optional(),
  vendorName: z.string().optional(),
  costMinor: z.number().int().optional(),
  performedBy: z.string().optional(),
  notes: z.string().optional(),
  maintenanceId: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "fleet:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    if (body.action === "schedule") {
      return { maintenance: await scheduleMaintenance(id, {
        type: body.type ?? "ROUTINE",
        description: body.description,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        odometerKm: body.odometerKm,
        vendorName: body.vendorName,
      }) };
    }
    if (!body.maintenanceId) throw new Error("maintenanceId required for complete action");
    return { maintenance: await completeMaintenance(body.maintenanceId, {
      costMinor: body.costMinor ?? 0,
      odometerKm: body.odometerKm,
      performedBy: session?.sub,
      notes: body.notes,
    }) };
  });
}
