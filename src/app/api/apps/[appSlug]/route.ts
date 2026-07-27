import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/utils/api";

export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ appSlug: string }> }) {
  return handle(req, async () => {
    const { appSlug } = await ctx.params;
    const app = await db.application.findUnique({
      where: { slug: appSlug },
      include: { _count: { select: { users: true, routes: true } } },
    });
    if (!app) throw new Error("Application not found");
    return { app };
  });
}
