// Training modules — list + assign
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { z } from "zod";

const assignSchema = z.object({
  moduleId: z.string(),
  moduleName: z.string(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workers:approve");
    const { id } = await ctx.params;
    const body = await parseJson(req, assignSchema);
    const worker = await db.worker.findUnique({ where: { id } });
    if (!worker) throw notFound();
    const record = await db.trainingRecord.create({
      data: {
        workerId: id,
        moduleId: body.moduleId,
        moduleName: body.moduleName,
        status: "NOT_STARTED",
      },
    });
    return { trainingRecord: record };
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await ctx.params;
    const records = await db.trainingRecord.findMany({
      where: { workerId: id },
      orderBy: { createdAt: "desc" },
    });
    return { items: records };
  });
}
