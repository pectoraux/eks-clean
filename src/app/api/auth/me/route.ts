import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, unauthorized, notFound } from "@/lib/utils/api";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const user = await db.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        status: true,
        mfaEnabled: true,
        lastLoginAt: true,
      },
    });
    if (!user) throw notFound();
    let profile: unknown = null;
    if (user.role === "CUSTOMER") {
      profile = await db.customer.findUnique({ where: { userId: user.id } });
    } else if (user.role === "WORKER") {
      profile = await db.worker.findUnique({ where: { userId: user.id } });
    } else if (user.role === "SALES_AGENT") {
      profile = await db.salesAgent.findUnique({ where: { userId: user.id } });
    } else if (user.role === "FIELD_MANAGER") {
      profile = await db.fieldManager.findUnique({ where: { userId: user.id } });
    }
    return { user, profile };
  });
}
