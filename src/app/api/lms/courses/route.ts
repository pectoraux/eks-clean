// LMS courses — list + create
import { NextRequest } from "next/server";
import { getSessionFromHeaders } from "@/lib/auth";
import { requirePerm, handle, parseJson } from "@/lib/utils/api";
import { writeAudit } from "@/lib/audit";
import { createCourse, addLesson, addExam } from "@/lib/modules/lms/service";
import { db } from "@/lib/db";
import { z } from "zod";

const courseSchema = z.object({
  code: z.string(),
  title: z.string(),
  description: z.string().optional(),
  category: z.string(),
  difficulty: z.string().optional(),
  estimatedHours: z.number().optional(),
  prereqCourseIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "lms:read");
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const items = await db.course.findMany({
      where: { ...(category ? { category } : {}), isActive: true },
      include: { _count: { select: { lessons: true, exams: true, enrollments: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { items };
  });
}

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    requirePerm(session, "lms:manage");
    const body = await parseJson(req, courseSchema);
    const course = await createCourse({ ...body, createdBy: session?.sub });
    await writeAudit({ action: "lms.course_create", resourceType: "Course", resourceId: course.id });
    return { course };
  });
}
