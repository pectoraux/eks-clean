// Add lesson to course
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { addLesson } from "@/lib/modules/lms/service";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
  contentMarkdown: z.string().optional(),
  contentUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  durationMin: z.number().int().optional(),
  passingScorePercent: z.number().optional(),
  isRequired: z.boolean().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "lms:manage");
    const { id } = await ctx.params;
    const body = await parseJson(req, schema);
    return { lesson: await addLesson(id, body) };
  });
}
