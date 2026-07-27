// Waste collection schedules
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const scheduleSchema = z.object({
  zoneCode: z.string(),
  routeCode: z.string().optional(),
  pickupDay: z.number().int().min(0).max(6),
  pickupWindow: z.string(),
  wasteCategories: z.string(),
  truckId: z.string().optional(),
  driverWorkerId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "dispatch:read");
    const url = new URL(req.url);
    const zone = url.searchParams.get("zone") || undefined;
    const items = await db.wasteSchedule.findMany({
      where: { ...(zone ? { zoneCode: zone } : {}), isActive: true },
      orderBy: { zoneCode: "asc" },
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "dispatch:override");
    const body = await parseJson(req, scheduleSchema);
    const schedule = await db.wasteSchedule.create({
      data: body,
    });
    await writeAudit({
      action: "waste.schedule_create",
      resourceType: "WasteSchedule",
      resourceId: schedule.id,
    });
    return { schedule };
  });
}
