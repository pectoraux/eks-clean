import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { pricingMetrics } from "@/lib/modules/pricing-engine/service";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "analytics:read" as never);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (!orgId) return { totalRules: 0, activeRules: 0, totalQuotes: 0, avgQuoteValueMinor: 0 };
    return pricingMetrics(orgId);
  });
}
