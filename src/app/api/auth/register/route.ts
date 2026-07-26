/**
 * Auth API — registration
 * ============================================================================
 *  IMPORTANT (waitlist flow):
 *    Sign-up NO LONGER creates a User account. Instead it creates a
 *    WaitlistEntry. The user receives a "you're on the waitlist" message.
 *    An admin reviews the entry and calls POST /api/admin/waitlist/:id/approve
 *    to materialise the User + role-specific profile. This keeps public
 *    self-service open without giving attackers a way to create accounts
 *    that can hit authenticated endpoints.
 *
 *  Backward-compat note: existing demo accounts (admin@, fm1@, sales1@,
 *    adwoa@, samuel.w@, kofi@) are seeded directly and not affected.
 * ============================================================================
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import {
  handle,
  parseJson,
  getIp,
  getUserAgent,
  badRequest,
  auditCtx,
} from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const registerSchema = z.object({
  // Allow non-standard emails like "user@gmail" (no TLD) for backward compat
  email: z.string().min(3).max(254).refine(
    (v) => /^[^\s@]+@[^\s@]+$/.test(v),
    { message: "Invalid email address" },
  ),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
  phone: z.string().optional(),
  role: z.enum(["CUSTOMER", "WORKER", "SALES_AGENT", "FIELD_MANAGER"]).default("CUSTOMER"),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const body = await parseJson(req, registerSchema);

    // Reject if email already exists as either a real user OR a pending waitlist entry
    const [existingUser, existingWait] = await Promise.all([
      db.user.findUnique({ where: { email: body.email } }),
      db.waitlistEntry.findUnique({ where: { email: body.email } }),
    ]);
    if (existingUser) throw badRequest("Email already registered");
    if (existingWait && existingWait.status === "PENDING") {
      throw badRequest("You're already on the waitlist. We'll be in touch soon.");
    }
    if (existingWait && existingWait.status === "APPROVED") {
      throw badRequest("Your account has been approved. Please sign in.");
    }
    // If previously REJECTED, allow re-application by overwriting

    // Pre-hash the password so admin approval is one click (no plaintext stored)
    const passwordHash = hashPassword(body.password);

    const entry = await db.waitlistEntry.upsert({
      where: { email: body.email },
      update: {
        fullName: body.fullName,
        phone: body.phone,
        passwordHash,
        requestedRole: body.role,
        status: "PENDING",
        rejectionReason: null,
        reviewedBy: null,
        reviewedAt: null,
        source: "WEB",
        ipAddress: getIp(req),
        userAgent: getUserAgent(req),
      },
      create: {
        email: body.email,
        fullName: body.fullName,
        phone: body.phone,
        passwordHash,
        requestedRole: body.role,
        status: "PENDING",
        source: "WEB",
        ipAddress: getIp(req),
        userAgent: getUserAgent(req),
      },
    });

    await writeAudit({
      ctx: auditCtx(req),
      action: "waitlist.submit",
      resourceType: "WaitlistEntry",
      resourceId: entry.id,
      after: { email: body.email, requestedRole: body.role },
    });

    return {
      status: "WAITLISTED",
      message: "Thanks for your interest! You've been added to our waitlist. Our team will review your application and email you when your account is ready.",
      entryId: entry.id,
    };
  });
}
