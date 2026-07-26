// Property metrics
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { propertyMetrics } from "@/lib/modules/property-twin/service";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "customers:read" as never);
    const url = new URL(req.url);
    return propertyMetrics(url.searchParams.get("organizationId") || undefined);
  });
}
