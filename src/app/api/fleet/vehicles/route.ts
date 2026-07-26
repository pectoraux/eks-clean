// Fleet vehicles — list + create + actions
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createVehicle, assignVehicle, returnVehicle, logFuel, scheduleMaintenance, completeMaintenance, recordInspection, fleetMetrics } from "@/lib/modules/fleet/service";
import { db } from "@/lib/db";
import { z } from "zod";

const vehicleSchema = z.object({
  plateNumber: z.string(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  type: z.string(),
  color: z.string().optional(),
  vin: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "fleet:read");
    const url = new URL(req.url);
    if (url.searchParams.get("metrics") === "true") {
      return fleetMetrics();
    }
    const items = await db.vehicle.findMany({
      include: { _count: { select: { maintenance: true, fuelLogs: true, inspections: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "fleet:manage");
    const body = await parseJson(req, vehicleSchema);
    return { vehicle: await createVehicle(body) };
  });
}
