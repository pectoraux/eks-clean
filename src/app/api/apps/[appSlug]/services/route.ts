/**
 * App API: List services for an application (uses protocol capabilities)
 * GET /api/apps/[appSlug]/services
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/utils/api";

export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ appSlug: string }> }) {
  return handle(req, async () => {
    const { appSlug } = await ctx.params;
    const app = await db.application.findUnique({ where: { slug: appSlug } });
    if (!app) throw new Error("Application not found");
    // Return capabilities registered by this app's protocol
    const items = await db.capability.findMany({
      where: { organizationId: app.organizationId, protocolId: app.protocolKey, isActive: true },
      orderBy: { code: "asc" },
    });
    return { items };
  });
}
