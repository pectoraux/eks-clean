// Worker Availability API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, parseJson, unauthorized, notFound, forbidden } from "@/lib/utils/api";
import { z } from "zod";

const schema = z.object({
  availabilities: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
    isAvailable: z.boolean().default(true),
  })),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);

    // Worker updates own availability, or admin/manager
    if (session.role === "WORKER") {
      const w = await db.worker.findUnique({ where: { userId: session.sub } });
      if (w?.id !== id) throw forbidden();
    }

    // Replace all availabilities
    await db.workerAvailability.deleteMany({ where: { workerId: id } });
    await db.workerAvailability.createMany({
      data: body.availabilities.map((a) => ({ ...a, workerId: id })),
    });
    const availabilities = await db.workerAvailability.findMany({ where: { workerId: id } });
    return { availabilities };
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await ctx.params;
    const availabilities = await db.workerAvailability.findMany({ where: { workerId: id } });
    return { availabilities };
  });
}
