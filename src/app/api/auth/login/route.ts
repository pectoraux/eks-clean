import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, issueSession } from "@/lib/auth";
import {
  handle,
  parseJson,
  getIp,
  getUserAgent,
  unauthorized,
  auditCtx,
  HttpError,
} from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { consume, LIMITS } from "@/lib/ratelimit";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const body = await parseJson(req, schema);
    const ip = getIp(req) ?? "unknown";
    const rl = await consume(`login:${ip}:${body.email}`, LIMITS.LOGIN.max, LIMITS.LOGIN.refillPerSec);
    if (!rl.allowed) {
      throw new HttpError(429, "Too many login attempts", "RATE_LIMITED", { retryAfterMs: rl.retryAfterMs });
    }

    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user || user.status !== "ACTIVE") {
      await writeAudit({
        ctx: auditCtx(req),
        action: "user.login",
        outcome: "FAILURE",
        reason: "no such user",
      });
      throw unauthorized("Invalid credentials");
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw unauthorized("Account temporarily locked");
    }
    if (!verifyPassword(body.password, user.passwordHash)) {
      await db.user.update({
        where: { id: user.id },
        data: { failedLoginCount: { increment: 1 } },
      });
      await writeAudit({
        ctx: auditCtx(req),
        action: "user.login",
        resourceType: "User",
        resourceId: user.id,
        outcome: "FAILURE",
        reason: "bad password",
      });
      throw unauthorized("Invalid credentials");
    }

    const session = await issueSession({
      id: user.id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
      ctx: { userAgent: getUserAgent(req), ipAddress: ip },
    });

    await writeAudit({
      ctx: auditCtx(req),
      action: "user.login",
      resourceType: "User",
      resourceId: user.id,
    });

    return {
      user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      session,
    };
  });
}
