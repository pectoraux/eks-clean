import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { captureSnapshot, snapshotSeries } from "@/lib/modules/analytics-advanced/service";
import { z } from "zod";

const captureSchema = z.object({
  metricKey: z.string(),
  period: z.string(),
  periodType: z.string().default("DAY"),
  value: z.number(),
  dimensions: z.record(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:read");
    const url = new URL(req.url);
    const metricKey = url.searchParams.get("metricKey");
    if (!metricKey) return { items: [] };
    return { items: await snapshotSeries(metricKey, Number(url.searchParams.get("last") ?? 30)) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:reports:manage");
    const body = await parseJson(req, captureSchema);
    return { snapshot: await captureSnapshot(body.metricKey, body.period, body.periodType, body.value, body.dimensions) };
  });
}
