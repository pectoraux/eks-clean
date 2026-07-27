// Shift scheduling — list + create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { scheduleShift, shiftsForDate } from "@/lib/modules/workforce/service";
import { z } from "zod";

const schema = z.object({
  workerId: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  type: z.string().default("REGULAR"),
  zone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:read");
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const zone = url.searchParams.get("zone") || undefined;
    if (date) {
      return { items: await shiftsForDate(new Date(date), zone) };
    }
    const items = await db.shiftSchedule.findMany({
      include: { worker: { include: { user: true } } },
      orderBy: { date: "desc" },
      take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:schedules:manage");
    const body = await parseJson(req, schema);
    return { shift: await scheduleShift({
      workerId: body.workerId,
      date: new Date(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
      type: body.type,
      zone: body.zone,
      notes: body.notes,
    }) };
  });
}
