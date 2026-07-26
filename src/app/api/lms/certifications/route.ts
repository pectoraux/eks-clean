// List certifications + overdue recertifications
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle } from "@/lib/utils/api";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "lms:read");
    const items = await db.certification.findMany({
      where: { status: "ACTIVE" },
      include: { worker: { include: { user: true } }, course: true },
      orderBy: { issuedAt: "desc" },
      take: 50,
    });
    return { items };
  });
}
