// Workforce pay grades — list + create + assign
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createPayGrade, assignPayGrade } from "@/lib/modules/workforce/service";
import { z } from "zod";

const schema = z.object({
  code: z.string(),
  name: z.string(),
  baseHourlyMinor: z.number().int().min(0),
  overtimeMultiplier: z.number().default(1.5),
  weekendMultiplier: z.number().default(1.25),
  holidayMultiplier: z.number().default(2.0),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:read");
    const items = await db.payGrade.findMany({ where: { isActive: true }, orderBy: { baseHourlyMinor: "asc" } });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workforce:paygrades:manage");
    const body = await parseJson(req, schema);
    return { payGrade: await createPayGrade(body) };
  });
}
