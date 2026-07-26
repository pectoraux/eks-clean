import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { cohortRetention, churnRiskList } from "@/lib/modules/analytics-advanced/service";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:read");
    const url = new URL(req.url);
    if (url.searchParams.get("type") === "churn") {
      return { items: await churnRiskList() };
    }
    const months = Number(url.searchParams.get("months") ?? 6);
    return { cohorts: await cohortRetention(months) };
  });
}
