/**
 * Auth API routes
 *   POST /api/auth/register       — create user + customer/worker profile
 *   POST /api/auth/login          — email/password login
 *   POST /api/auth/refresh        — rotate refresh token
 *   POST /api/auth/logout         — revoke refresh token
 *   GET  /api/auth/me             — current session user
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  issueSession,
  rotateRefreshToken,
  revokeRefreshToken,
  getSessionFromHeaders,
} from "@/lib/auth";
import {
  handle,
  parseJson,
  getIp,
  getUserAgent,
  badRequest,
  auditCtx,
} from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { consume, LIMITS } from "@/lib/ratelimit";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
  phone: z.string().optional(),
  role: z.enum(["CUSTOMER", "WORKER", "SALES_AGENT", "FIELD_MANAGER"]).default("CUSTOMER"),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const body = await parseJson(req, registerSchema);
    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) throw badRequest("Email already registered");

    const user = await db.user.create({
      data: {
        email: body.email,
        passwordHash: hashPassword(body.password),
        fullName: body.fullName,
        phone: body.phone,
        role: body.role,
        status: "ACTIVE",
      },
    });

    // Provision role-specific profile
    if (body.role === "CUSTOMER") {
      await db.customer.create({ data: { userId: user.id } });
    } else if (body.role === "WORKER") {
      await db.worker.create({ data: { userId: user.id } });
    } else if (body.role === "SALES_AGENT") {
      const code = `EKS-${user.id.slice(0, 6).toUpperCase()}`;
      await db.salesAgent.create({ data: { userId: user.id, referralCode: code } });
    } else if (body.role === "FIELD_MANAGER") {
      await db.fieldManager.create({ data: { userId: user.id } });
    }

    const session = await issueSession({
      id: user.id,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
      ctx: { userAgent: getUserAgent(req), ipAddress: getIp(req) },
    });

    await writeAudit({
      ctx: auditCtx(req),
      action: "user.register",
      resourceType: "User",
      resourceId: user.id,
      after: { email: user.email, role: user.role },
    });

    return { user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName }, session };
  });
}
