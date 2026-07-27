import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle, parseJson } from "@/lib/utils/api";
import { randomBytes, pbkdf2Sync } from "crypto";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({ email: z.string(), password: z.string() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ appSlug: string }> }) {
  return handle(req, async () => {
    const { appSlug } = await ctx.params;
    const app = await db.application.findUnique({ where: { slug: appSlug } });
    if (!app) throw new Error("Application not found");
    const body = await parseJson(req, schema);

    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user) throw new Error("Invalid credentials");
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
