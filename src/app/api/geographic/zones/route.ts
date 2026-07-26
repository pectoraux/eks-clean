// Zones — list for organization
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { getZonesForOrganization } from "@/lib/modules/geographic/service";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session as never, "analytics:read" as never);
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    if (!orgId) return { items: [] };
    return { items: await getZonesForOrganization(orgId) };
  });
}
