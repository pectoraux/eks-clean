/**
 * Admin: list waitlist entries
 * GET /api/admin/waitlist?status=PENDING|APPROVED|REJECTED
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "admin:users");
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const role = url.searchParams.get("role") || undefined;
    const limit = Number(url.searchParams.get("limit") ?? 100);

    const [items, total] = await Promise.all([
      db.waitlistEntry.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(role ? { requestedRole: role } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.waitlistEntry.count({
        where: {
          ...(status ? { status } : {}),
          ...(role ? { requestedRole: role } : {}),
        },
      }),
    ]);

    return { items, total };
  });
}
