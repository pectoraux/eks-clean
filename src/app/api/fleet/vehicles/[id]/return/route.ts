import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { returnVehicle } from "@/lib/modules/fleet/service";
import { z } from "zod";

const schema = z.object({ endingMileageKm: z.number().int(), notes: z.string().optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "fleet:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    // Find latest active assignment for this vehicle
    const assignment = await (await import("@/lib/db")).db.vehicleAssignment.findFirst({
      where: { vehicleId: id, returnedAt: null },
      orderBy: { assignedAt: "desc" },
    });
    if (!assignment) throw new Error("No active assignment");
    return { assignment: await returnVehicle(assignment.id, body.endingMileageKm, body.notes) };
  });
}
