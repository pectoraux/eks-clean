/**
 * Admin API: List protocols (for admin console)
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle } from "@/lib/utils/api";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const url = new URL(req.url);
    const orgId = url.searchParams.get("organizationId");
    const items = await db.protocolInstallation.findMany({
      where: orgId ? { organizationId: orgId } : {},
      orderBy: { installedAt: "desc" },
    });
    return { items };
  });
}
