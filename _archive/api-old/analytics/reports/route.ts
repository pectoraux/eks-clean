import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { scheduleReport, dueReports } from "@/lib/modules/analytics-advanced/service";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  description: z.string().optional(),
  schedule: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY"]),
  recipients: z.array(z.string()),
  config: z.unknown(),
  format: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:read");
    return { items: await dueReports() };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:reports:manage");
    const body = await parseJson(req, schema);
    return { report: await scheduleReport({ ...body, createdBy: session?.sub }) };
  });
}
