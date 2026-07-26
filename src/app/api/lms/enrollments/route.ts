// Enroll worker in course + list enrollments + complete lesson + submit exam
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { enrollWorker, markLessonComplete } from "@/lib/modules/lms/service";
import { db } from "@/lib/db";
import { z } from "zod";

const enrollSchema = z.object({
  workerId: z.string(),
  courseId: z.string(),
  dueAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "lms:read");
    const url = new URL(req.url);
    const workerId = url.searchParams.get("workerId") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const items = await db.enrollment.findMany({
      where: { ...(workerId ? { workerId } : {}), ...(status ? { status } : {}) },
      include: { course: { include: { _count: { select: { lessons: true } } } }, worker: { include: { user: true } } },
      orderBy: { enrolledAt: "desc" },
      take: 50,
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "lms:enroll");
    const body = await parseJson(req, enrollSchema);
    const enrollment = await enrollWorker(
      body.workerId,
      body.courseId,
      session?.sub,
      body.dueAt ? new Date(body.dueAt) : undefined,
    );
    await writeAudit({ action: "lms.enroll", resourceType: "Enrollment", resourceId: enrollment.id });
    return { enrollment };
  });
}
