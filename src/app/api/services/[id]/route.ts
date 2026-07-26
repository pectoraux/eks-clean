// Manage a single service type
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  basePriceMinor: z.number().int().min(0).optional(),
  estimatedDurationMin: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  requiresCertification: z.string().nullable().optional(),
  configJson: z.string().nullable().optional(),
  iconUrl: z.string().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "services:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, updateSchema);
    const updated = await db.serviceType.update({
      where: { id },
      data: body,
    });
    return { service: updated };
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "services:manage");
    const { id } = await ctx.params;
    // Soft delete by deactivating
    const updated = await db.serviceType.update({
      where: { id },
      data: { isActive: false },
    });
    return { service: updated };
  });
}
