/**
 * App API: Get application by slug (public — for landing page)
 * Also handles creating applications
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { hashPassword, randomBytes } from "crypto";
import { z } from "zod";

export const maxDuration = 60;

// GET /api/apps/[appSlug] — get app info (public)
export async function GET(req: NextRequest, ctx: { params: Promise<{ appSlug: string }> }) {
  return handle(req, async () => {
    const { appSlug } = await ctx.params;
    const app = await db.application.findUnique({
      where: { slug: appSlug },
      include: { _count: { select: { users: true, routes: true } } },
    });
    if (!app) return { error: "Application not found" };
    return { app };
  });
}

// POST /api/apps/[appSlug] — app-level auth (login/register)
const authSchema = z.object({
  action: z.enum(["login", "register"]),
  email: z.string(),
  password: z.string(),
  fullName: z.string().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ appSlug: string }> }) {
  return handle(req, async () => {
    const { appSlug } = await ctx.params;
    const app = await db.application.findUnique({ where: { slug: appSlug } });
    if (!app) throw new Error("Application not found");

    const body = await parseJson(req, authSchema);

    if (body.action === "register") {
      // Find or create OpsOS User
      let user = await db.user.findUnique({ where: { email: body.email } });
      if (!user) {
        const salt = randomBytes(16);
        const { pbkdf2Sync } = await import("crypto");
        const derived = pbkdf2Sync(body.password, salt, 120000, 32, "sha256");
        user = await db.user.create({
          data: {
            email: body.email,
            passwordHash: `pbkdf2$120000$${salt.toString("base64")}$${derived.toString("base64")}`,
            fullName: body.fullName || body.email,
            status: "ACTIVE",
            organizationId: app.organizationId,
          },
        });
      }
      // Create AppUser
      const appUser = await db.appUser.upsert({
        where: { applicationId_userId: { applicationId: app.id, userId: user.id } },
        update: { status: "ACTIVE" },
        create: { applicationId: app.id, userId: user.id, role: "CUSTOMER", status: "ACTIVE" },
      });
      // Create session
      const tokenHash = randomBytes(32).toString("hex");
      const session = await db.appSession.create({
        data: { applicationId: app.id, appUserId: appUser.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
      return { session: { accessToken: tokenHash, appUser: { id: appUser.id, role: appUser.role, userId: user.id } } };
    }

    // Login
    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user) throw new Error("Invalid credentials");
    const { pbkdf2Sync } = await import("crypto");
    const parts = user.passwordHash.split("$");
    if (parts.length !== 4) throw new Error("Invalid credentials");
    const salt = Buffer.from(parts[2], "base64");
    const derived = pbkdf2Sync(body.password, salt, parseInt(parts[1]), 32, "sha256");
    if (derived.toString("base64") !== parts[3]) throw new Error("Invalid credentials");

    const appUser = await db.appUser.upsert({
      where: { applicationId_userId: { applicationId: app.id, userId: user.id } },
      update: {},
      create: { applicationId: app.id, userId: user.id, role: "CUSTOMER" },
    });
    const tokenHash = randomBytes(32).toString("hex");
    await db.appSession.create({
      data: { applicationId: app.id, appUserId: appUser.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    return { session: { accessToken: tokenHash, appUser: { id: appUser.id, role: appUser.role, userId: user.id } } };
  });
}
