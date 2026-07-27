// Subscription addons — list + create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { createAddon } from "@/lib/modules/subscriptions-advanced/service";
import { z } from "zod";

const schema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  priceMinor: z.number().int().min(0),
  billingCycle: z.string().default("MONTHLY"),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "subscriptions:read");
    const items = await db.subscriptionAddon.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "subscriptions:addons:manage");
    const body = await parseJson(req, schema);
    return { addon: await createAddon(body) };
  });
}
