// Worker Skills API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson, notFound } from "@/lib/utils/api";
import { z } from "zod";

const schema = z.object({
  skillCode: z.string(),
  proficiency: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]).default("BEGINNER"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "workers:approve");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    const skill = await db.workerSkill.create({
      data: { workerId: id, skillCode: body.skillCode, proficiency: body.proficiency },
    });
    return { skill };
  });
}
