import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { addExam } from "@/lib/modules/lms/service";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
  passingScorePercent: z.number().optional(),
  timeLimitMin: z.number().int().optional(),
  maxAttempts: z.number().int().optional(),
  isFinal: z.boolean().optional(),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
    type: z.string(),
    options: z.array(z.string()).optional(),
    correctAnswer: z.union([z.string(), z.number()]),
    points: z.number().optional(),
  })),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "lms:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { exam: await addExam(id, body) };
  });
}
