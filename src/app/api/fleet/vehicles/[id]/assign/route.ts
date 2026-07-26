import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { assignVehicle } from "@/lib/modules/fleet/service";
import { z } from "zod";

const schema = z.object({ workerId: z.string(), purpose: z.string().optional(), startingMileageKm: z.number().int().optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "fleet:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { assignment: await assignVehicle(id, body.workerId, body.purpose, body.startingMileageKm) };
  });
}
