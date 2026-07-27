// OpsOS Auth — Login (reuses existing auth infrastructure)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, issueSession } from "@/lib/auth";
import { handle, parseJson, getIp, getUserAgent } from "@/lib/utils/api";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  email: z.string().min(3).max(254).refine((v) => /^[^\s@]+@[^\s@]+$/.test(v), { message: "Invalid email address" }),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const body = await parseJson(req, schema);
    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user || user.status !== "ACTIVE") throw new Error("Invalid credentials");
    if (!verifyPassword(body.password, user.passwordHash)) throw new Error("Invalid credentials");
    const session = await issueSession({
      id: user.id, role: "ADMIN", email: user.email, fullName: user.fullName,
      ctx: { userAgent: getUserAgent(req), ipAddress: getIp(req) },
    });
    return { user: { id: user.id, email: user.email, fullName: user.fullName, organizationId: user.organizationId }, session };
  });
}
