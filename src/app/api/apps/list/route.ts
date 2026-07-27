/**
 * App API: List applications (for admin console)
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
    const items = await db.application.findMany({
      where: orgId ? { organizationId: orgId } : {},
      include: { _count: { select: { users: true, routes: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { items };
  });
}
