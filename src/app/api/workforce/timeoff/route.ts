// Time-off requests — list + create + approve/deny
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { requestTimeOff, approveTimeOff, denyTimeOff } from "@/lib/modules/workforce/service";
import { z } from "zod";

const createSchema = z.object({
  workerId: z.string(),
  type: z.enum(["VACATION", "SICK", "PERSONAL", "BEREAVEMENT", "UNPAID"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:read");
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const items = await db.timeOffRequest.findMany({
      where: { ...(status ? { status } : {}) },
      include: { worker: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:schedules:manage");
    const body = await parseJson(req, createSchema);
    return { request: await requestTimeOff({
      workerId: body.workerId,
      type: body.type,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      reason: body.reason,
    }) };
  });
}
