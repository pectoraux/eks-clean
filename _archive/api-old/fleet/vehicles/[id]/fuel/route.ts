import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { logFuel } from "@/lib/modules/fleet/service";
import { z } from "zod";

const schema = z.object({
  liters: z.number(),
  costMinor: z.number().int(),
  odometerKm: z.number().int(),
  fuelType: z.string().optional(),
  stationName: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "fleet:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { fuelLog: await logFuel(id, { ...body, filledBy: session?.sub }) };
  });
}
