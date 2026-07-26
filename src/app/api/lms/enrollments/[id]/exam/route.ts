import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { submitExamAttempt } from "@/lib/modules/lms/service";
import { z } from "zod";

const schema = z.object({
  examId: z.string(),
  answers: z.array(z.object({
    questionId: z.string(),
    selectedAnswer: z.union([z.string(), z.number()]),
  })),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "lms:enroll");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { attempt: await submitExamAttempt(id, body.examId, body.answers) };
  });
}
