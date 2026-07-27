// OpsOS Organizations — list + create
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson } from "@/lib/utils/api";
import { z } from "zod";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const items = await db.organization.findMany({ orderBy: { createdAt: "desc" } });
    return { items };
  });
}

const schema = z.object({
  code: z.string(), name: z.string(), currency: z.string().default("USD"),
  timezone: z.string().default("UTC"), plan: z.string().default("STARTER"),
  environment: z.string().default("PRODUCTION"),
});

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw new Error("Unauthorized");
    const body = await parseJson(req, schema);
    const org = await db.organization.create({ data: body });
    // Assign user to org
    await db.user.update({ where: { id: session.sub }, data: { organizationId: org.id } });
    return { organization: org };
  });
}
