// Saved queries — list + create + run
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { saveQuery, runQuery } from "@/lib/modules/analytics-event-sourced/service";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  description: z.string().optional(),
  queryType: z.string(),
  dataSource: z.string(),
  config: z.record(z.string(), z.any()),
  isPublic: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:events:read");
    const items = await db.analyticsQuery.findMany({
      where: { OR: [{ isPublic: true }, { createdBy: session?.sub }] },
      orderBy: { updatedAt: "desc" },
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "analytics:queries:manage");
    const body = await parseJson(req, schema);
    return { query: await saveQuery({ ...body, createdBy: session?.sub }) };
  });
}
