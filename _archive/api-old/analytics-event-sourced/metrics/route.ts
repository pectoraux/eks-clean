import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { eventSourcedMetrics } from "@/lib/modules/analytics-event-sourced/service";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:events:read");
    return eventSourcedMetrics();
  });
}
