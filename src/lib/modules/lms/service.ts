/**
 * ============================================================================
 *  LMS — Learning Management System
 * ============================================================================
 *  Course → Lessons → Exams → Enrollments → Certifications
 *
 *  Certification lifecycle:
 *    ACTIVE → (expiresAt) → EXPIRED → REVOKE
 *    Recertification scheduled automatically 30 days before expiry
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Courses
// ---------------------------------------------------------------------------

export async function createCourse(input: {
  code: string;
  title: string;
  description?: string;
  category: string;
  difficulty?: string;
  estimatedHours?: number;
  prereqCourseIds?: string[];
  createdBy?: string;
}) {
  const existing = await db.course.findUnique({ where: { code: input.code } });
  if (existing) throw conflict(`Course ${input.code} already exists`);
  return db.course.create({
    data: {
      code: input.code,
      title: input.title,
      description: input.description,
      category: input.category,
      difficulty: input.difficulty ?? "BEGINNER",
      estimatedHours: input.estimatedHours ?? 1,
      prereqCourseIds: input.prereqCourseIds?.join(","),
      createdBy: input.createdBy,
    },
  });
}

export async function addLesson(courseId: string, input: {
  title: string;
  contentMarkdown?: string;
  contentUrl?: string;
  videoUrl?: string;
  durationMin?: number;
  passingScorePercent?: number;
  isRequired?: boolean;
}) {
  const course = await db.course.findUnique({ where: { id: courseId }, include: { lessons: true } });
  if (!course) throw notFound("Course not found");
  const order = course.lessons.length + 1;
  return db.lesson.create({
    data: {
      courseId,
      order,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      contentUrl: input.contentUrl,
      videoUrl: input.videoUrl,
      durationMin: input.durationMin ?? 15,
      passingScorePercent: input.passingScorePercent ?? 70,
      isRequired: input.isRequired ?? true,
    },
  });
}

export async function addExam(courseId: string, input: {
  title: string;
  passingScorePercent?: number;
  timeLimitMin?: number;
  maxAttempts?: number;
  questions: Array<{ id: string; text: string; type: string; options?: string[]; correctAnswer: string | number; points?: number }>;
  isFinal?: boolean;
}) {
  return db.exam.create({
    data: {
      courseId,
      title: input.title,
      passingScorePercent: input.passingScorePercent ?? 70,
      timeLimitMin: input.timeLimitMin ?? 60,
      maxAttempts: input.maxAttempts ?? 3,
      questionsJson: JSON.stringify(input.questions),
      isFinal: input.isFinal ?? false,
    },
  });
}

// ---------------------------------------------------------------------------
//  Enrollments & progress
// ---------------------------------------------------------------------------

export async function enrollWorker(workerId: string, courseId: string, assignedBy?: string, dueAt?: Date) {
  const [worker, course] = await Promise.all([
    db.worker.findUnique({ where: { id: workerId } }),
    db.course.findUnique({ where: { id: courseId } }),
  ]);
  if (!worker) throw notFound("Worker not found");
  if (!course) throw notFound("Course not found");

  // Check prereqs
  if (course.prereqCourseIds) {
    const prereqIds = course.prereqCourseIds.split(",").filter(Boolean);
    for (const pid of prereqIds) {
      const prereqEnrollment = await db.enrollment.findUnique({
        where: { workerId_courseId: { workerId, courseId: pid } },
      });
      if (!prereqEnrollment || prereqEnrollment.status !== "COMPLETED") {
        throw badRequest(`Prerequisite course ${pid} not completed`);
      }
    }
  }

  try {
    return await db.enrollment.create({
      data: { workerId, courseId, status: "NOT_STARTED", assignedBy, dueAt },
      include: { course: true },
    });
  } catch {
    throw conflict("Worker already enrolled");
  }
}

export async function markLessonComplete(enrollmentId: string, lessonId: string, scorePercent?: number) {
  const enrollment = await db.enrollment.findUnique({ where: { id: enrollmentId } });
  if (!enrollment) throw notFound("Enrollment not found");
  if (enrollment.status === "COMPLETED") throw conflict("Enrollment already completed");

  const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw notFound("Lesson not found");

  const passing = scorePercent ? scorePercent >= lesson.passingScorePercent : true;

  await db.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    update: {
      status: passing ? "COMPLETED" : "FAILED",
      completedAt: new Date(),
      scorePercent,
      attempts: { increment: 1 },
    },
    create: {
      enrollmentId,
      lessonId,
      status: passing ? "COMPLETED" : "FAILED",
      completedAt: new Date(),
      scorePercent,
      attempts: 1,
    },
  });

  // If first lesson completed, mark enrollment IN_PROGRESS
  if (enrollment.status === "NOT_STARTED") {
    await db.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
  }

  // Check if all required lessons are complete
  await checkAndCompleteEnrollment(enrollmentId);
}

async function checkAndCompleteEnrollment(enrollmentId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      course: { include: { lessons: true, exams: true } },
      lessonProgress: true,
      examAttempts: true,
    },
  });
  if (!enrollment || !enrollment.course) return;

  const requiredLessons = enrollment.course.lessons.filter((l) => l.isRequired);
  const completedLessons = requiredLessons.filter((rl) => {
    const lp = enrollment.lessonProgress.find((p) => p.lessonId === rl.id);
    return lp?.status === "COMPLETED";
  });
  if (completedLessons.length < requiredLessons.length) return;

  // All required lessons done — check final exam
  const finalExam = enrollment.course.exams.find((e) => e.isFinal);
  if (finalExam) {
    const bestAttempt = enrollment.examAttempts
      .filter((a) => a.examId === finalExam.id && a.passed)
      .sort((a, b) => (b.scorePercent ?? 0) - (a.scorePercent ?? 0))[0];
    if (!bestAttempt) return; // exam not passed yet
    await completeEnrollment(enrollmentId, bestAttempt.scorePercent ?? 0);
  } else {
    // No final exam — auto-complete
    const avgLesson = enrollment.lessonProgress
      .map((p) => p.scorePercent ?? 100)
      .reduce((s, v) => s + v, 0) / Math.max(1, enrollment.lessonProgress.length);
    await completeEnrollment(enrollmentId, avgLesson);
  }
}

async function completeEnrollment(enrollmentId: string, scorePercent: number) {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: true },
  });
  if (!enrollment) return;

  const certNumber = `EKS-CERT-${Date.now().toString(36).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

  const certification = await db.certification.create({
    data: {
      workerId: enrollment.workerId,
      courseId: enrollment.courseId,
      certificateNumber: certNumber,
      issuedAt: new Date(),
      expiresAt,
      status: "ACTIVE",
    },
  });

  await db.enrollment.update({
    where: { id: enrollmentId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      finalScorePercent: scorePercent,
      certificateId: certification.id,
    },
  });

  // Schedule recertification 30 days before expiry
  const recertDate = new Date(expiresAt.getTime() - 30 * 24 * 60 * 60 * 1000);
  await db.recertificationSchedule.create({
    data: { certificationId: certification.id, dueAt: recertDate, status: "SCHEDULED" },
  });

  await publish({
    eventType: "lms.certification_issued",
    payload: { workerId: enrollment.workerId, courseId: enrollment.courseId, certNumber, expiresAt },
  });
}

// ---------------------------------------------------------------------------
//  Exam attempts
// ---------------------------------------------------------------------------

export async function submitExamAttempt(enrollmentId: string, examId: string, answers: Array<{ questionId: string; selectedAnswer: string | number }>) {
  const [enrollment, exam] = await Promise.all([
    db.enrollment.findUnique({ where: { id: enrollmentId } }),
    db.exam.findUnique({ where: { id: examId } }),
  ]);
  if (!enrollment) throw notFound("Enrollment not found");
  if (!exam) throw notFound("Exam not found");

  // Count existing attempts
  const existingAttempts = await db.examAttempt.count({ where: { enrollmentId, examId } });
  if (existingAttempts >= exam.maxAttempts) {
    throw conflict("Max attempts reached");
  }

  // Score
  const questions = JSON.parse(exam.questionsJson) as Array<{ id: string; correctAnswer: string | number; points?: number }>;
  let earned = 0;
  let total = 0;
  for (const q of questions) {
    const points = q.points ?? 1;
    total += points;
    const ans = answers.find((a) => a.questionId === q.id);
    if (ans && ans.selectedAnswer === q.correctAnswer) earned += points;
  }
  const scorePercent = total > 0 ? (earned / total) * 100 : 0;
  const passed = scorePercent >= exam.passingScorePercent;

  const attempt = await db.examAttempt.create({
    data: {
      enrollmentId,
      examId,
      attemptNumber: existingAttempts + 1,
      submittedAt: new Date(),
      scorePercent,
      passed,
      answersJson: JSON.stringify(answers),
    },
  });

  if (passed) {
    await checkAndCompleteEnrollment(enrollmentId);
  }

  await publish({ eventType: "lms.exam_submitted", payload: { enrollmentId, examId, scorePercent, passed } });
  return attempt;
}

// ---------------------------------------------------------------------------
//  Recertification
// ---------------------------------------------------------------------------

export async function getOverdueRecertifications() {
  return db.recertificationSchedule.findMany({
    where: {
      status: { in: ["SCHEDULED", "REMINDED"] },
      dueAt: { lt: new Date() },
    },
    include: { certification: { include: { worker: { include: { user: true } }, course: true } } },
  });
}
