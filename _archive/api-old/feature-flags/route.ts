// Feature flags API — admin reads/writes, anyone can read enabled state for own role
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { refreshCache } from "@/lib/feature-flags";
import { z } from "zod";

export async function GET() {
  return handle({} as NextRequest, async () => {
    const items = await db.featureFlag.findMany({ orderBy: { key: "asc" } });
    return { items };
  });
}

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  targetRoles: z.string().nullable().optional(),
  description: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "admin:feature_flags");
    const body = await parseJson(req, z.object({ key: z.string(), ...updateSchema.shape }));
    const { key, ...data } = body;
    const flag = await db.featureFlag.upsert({
      where: { key },
      update: data,
      create: { key, ...data },
    });
    await refreshCache();
    return { flag };
  });
}
