// Analytics views + reports + snapshots + cohorts + CLV
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { saveView, listViews, scheduleReport, dueReports, captureSnapshot, snapshotSeries, cohortRetention, customerLifetimeValue, churnRiskList } from "@/lib/modules/analytics-advanced/service";
import { z } from "zod";

const viewSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  config: z.unknown(),
  scope: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:read");
    return { items: await listViews(session?.sub) };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:views:manage");
    const body = await parseJson(req, viewSchema);
    return { view: await saveView({ ...body, ownerId: session?.sub }) };
  });
}
