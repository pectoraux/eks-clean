import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, issueSession } from "@/lib/auth";
import { getIp, getUserAgent } from "@/lib/utils/api";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  email: z.string().min(3).max(254).refine((v) => /^[^\s@]+@[^\s@]+$/.test(v), { message: "Invalid email address" }),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } }, { status: 401 });
    }
    if (!verifyPassword(body.password, user.passwordHash)) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid credentials" } }, { status: 401 });
    }
    const session = await issueSession({
      id: user.id, role: "ADMIN", email: user.email, fullName: user.fullName,
      ctx: { userAgent: getUserAgent(req), ipAddress: getIp(req) },
    });
    return NextResponse.json({ data: { user: { id: user.id, email: user.email, fullName: user.fullName, organizationId: user.organizationId }, session } });
  } catch (e) {
    return NextResponse.json({ error: { code: "INTERNAL", message: e instanceof Error ? e.message : "Unknown error", stack: e instanceof Error ? e.stack?.split("\n").slice(0,5).join(" | ") : undefined } }, { status: 500 });
  }
}
