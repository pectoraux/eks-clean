/**
 * ============================================================================
 *  Comprehensive Workforce Management
 *  - Skills matrix (Skill + SkillAssessment)
 *  - Pay grades + assignments
 *  - Time-off requests (with approval flow)
 *  - Shift scheduling
 *  - Performance scoring (multi-factor, trend tracking)
 * ============================================================================
 */

import { db } from "@/lib/db";
import { publish } from "@/lib/events/bus";
import { notFound, conflict, badRequest } from "@/lib/utils/api";

// ---------------------------------------------------------------------------
//  Skills matrix
// ---------------------------------------------------------------------------

export async function createSkill(input: { code: string; name: string; category?: string; description?: string; levels?: number; isCertificationRequired?: boolean }) {
  const existing = await db.skill.findUnique({ where: { code: input.code } });
  if (existing) throw conflict(`Skill ${input.code} already exists`);
  return db.skill.create({ data: input });
}

export async function assessSkill(input: {
  skillId: string; workerId: string; level: number; assessorId?: string; notes?: string; evidence?: string; expiresAt?: Date;
}) {
  const [skill, worker] = await Promise.all([
    db.skill.findUnique({ where: { id: input.skillId } }),
    db.worker.findUnique({ where: { id: input.workerId } }),
  ]);
  if (!skill) throw notFound("Skill not found");
  if (!worker) throw notFound("Worker not found");
  if (input.level < 1 || input.level > skill.levels) {
    throw badRequest(`Level must be 1..${skill.levels}`);
  }

  const assessment = await db.skillAssessment.upsert({
    where: { skillId_workerId: { skillId: input.skillId, workerId: input.workerId } },
    update: { level: input.level, notes: input.notes, evidence: input.evidence, assessorId: input.assessorId, expiresAt: input.expiresAt, assessedAt: new Date() },
    create: input,
  });

  await publish({ eventType: "workforce.skill_assessed", payload: { workerId: input.workerId, skillId: input.skillId, level: input.level } });
  return assessment;
}

export async function skillsMatrix(filter: { category?: string; workerId?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filter.category) where.category = filter.category;
  if (filter.workerId) {
    // Return only skills the worker has been assessed on
    return db.skill.findMany({
      where,
      include: {
        assessments: { where: { workerId: filter.workerId } },
      },
      orderBy: { category: "asc" },
    });
  }
  return db.skill.findMany({
    where,
    include: { _count: { select: { assessments: true } } },
    orderBy: { category: "asc" },
  });
}

// ---------------------------------------------------------------------------
//  Pay grades
// ---------------------------------------------------------------------------

export async function createPayGrade(input: {
  code: string; name: string; baseHourlyMinor: number;
  overtimeMultiplier?: number; weekendMultiplier?: number; holidayMultiplier?: number;
}) {
  const existing = await db.payGrade.findUnique({ where: { code: input.code } });
  if (existing) throw conflict(`Pay grade ${input.code} already exists`);
  return db.payGrade.create({ data: input });
}

export async function assignPayGrade(workerId: string, payGradeId: string, assignedBy?: string) {
  const [worker, grade] = await Promise.all([
    db.worker.findUnique({ where: { id: workerId } }),
    db.payGrade.findUnique({ where: { id: payGradeId } }),
  ]);
  if (!worker) throw notFound("Worker not found");
  if (!grade) throw notFound("Pay grade not found");

  // Close out the previous assignment
  await db.workerPayGradeAssignment.updateMany({
    where: { workerId, effectiveTo: null },
    data: { effectiveTo: new Date() },
  });

  return db.workerPayGradeAssignment.create({
    data: { workerId, payGradeId, assignedBy, effectiveFrom: new Date() },
  });
}

export async function getWorkerPayGrade(workerId: string) {
  const assignment = await db.workerPayGradeAssignment.findFirst({
    where: { workerId, effectiveTo: null },
    include: { payGrade: true },
    orderBy: { effectiveFrom: "desc" },
  });
  return assignment?.payGrade ?? null;
}

// ---------------------------------------------------------------------------
//  Time-off requests
// ---------------------------------------------------------------------------

export async function requestTimeOff(input: {
  workerId: string; type: string; startDate: Date; endDate: Date; reason?: string;
}) {
  if (input.endDate < input.startDate) throw badRequest("End date must be after start date");
  const worker = await db.worker.findUnique({ where: { id: input.workerId } });
  if (!worker) throw notFound("Worker not found");

  // Check for overlapping time-off
  const overlap = await db.timeOffRequest.findFirst({
    where: {
      workerId: input.workerId,
      status: { in: ["PENDING", "APPROVED"] },
      OR: [
        { startDate: { lte: input.endDate }, endDate: { gte: input.startDate } },
      ],
    },
  });
  if (overlap) throw conflict("Overlapping time-off request exists");

  return db.timeOffRequest.create({ data: input });
}

export async function approveTimeOff(requestId: string, reviewerId: string) {
  const req = await db.timeOffRequest.findUnique({ where: { id: requestId } });
  if (!req) throw notFound("Time-off request not found");
  if (req.status !== "PENDING") throw conflict("Already reviewed");

  const updated = await db.timeOffRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", reviewedBy: reviewerId, reviewedAt: new Date() },
  });

  await publish({ eventType: "workforce.timeoff_approved", payload: { workerId: req.workerId, requestId } });
  return updated;
}

export async function denyTimeOff(requestId: string, reviewerId: string, denialReason: string) {
  const req = await db.timeOffRequest.findUnique({ where: { id: requestId } });
  if (!req) throw notFound("Time-off request not found");
  if (req.status !== "PENDING") throw conflict("Already reviewed");

  return db.timeOffRequest.update({
    where: { id: requestId },
    data: { status: "DENIED", reviewedBy: reviewerId, reviewedAt: new Date(), denialReason },
  });
}

// ---------------------------------------------------------------------------
//  Shift scheduling
// ---------------------------------------------------------------------------

export async function scheduleShift(input: {
  workerId: string; date: Date; startTime: string; endTime: string; type?: string; zone?: string; notes?: string;
}) {
  const worker = await db.worker.findUnique({ where: { id: input.workerId } });
  if (!worker) throw notFound("Worker not found");

  // Check availability
  const dayOfWeek = new Date(input.date).getDay();
  const avail = await db.workerAvailability.findFirst({
    where: { workerId: input.workerId, dayOfWeek, isAvailable: true },
  });
  if (!avail) throw badRequest("Worker not available on this day");

  try {
    return await db.shiftSchedule.create({ data: { ...input, date: new Date(input.date) } });
  } catch {
    throw conflict("Shift already exists for this worker at this time");
  }
}

export async function shiftsForDate(date: Date, zone?: string) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return db.shiftSchedule.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(zone ? { zone } : {}),
    },
    include: { worker: { include: { user: true } } },
    orderBy: { startTime: "asc" },
  });
}

// ---------------------------------------------------------------------------
//  Performance scoring — multi-factor with trend
// ============================================================================

export async function computePerformanceScore(workerId: string, period: string) {
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    include: {
      ratings: { where: { createdAt: { gte: new Date(`${period}-01`) } } },
      assignments: { where: { status: "ACCEPTED" }, include: { booking: true } },
      qualityAudits: { where: { createdAt: { gte: new Date(`${period}-01`) } } },
      attendance: { where: { date: { gte: new Date(`${period}-01`) } } },
    },
  });
  if (!worker) throw notFound("Worker not found");

  // Punctuality: based on attendance
  const present = worker.attendance.filter((a) => a.status === "PRESENT").length;
  const late = worker.attendance.filter((a) => a.status === "LATE").length;
  const totalAttendance = worker.attendance.length;
  const punctualityScore = totalAttendance > 0
    ? ((present + late * 0.5) / totalAttendance) * 100
    : 80; // default if no attendance data

  // Quality: average rating + audit scores
  const avgRating = worker.ratings.length > 0
    ? (worker.ratings.reduce((s, r) => s + r.overall, 0) / worker.ratings.length) * 20 // 5→100
    : 80;
  const avgAudit = worker.qualityAudits.length > 0
    ? worker.qualityAudits.reduce((s, a) => s + a.score, 0) / worker.qualityAudits.length
    : 80;
  const qualityScore = (avgRating + avgAudit) / 2;

  // Productivity: completed jobs / total assignments
  const completed = worker.assignments.filter((a) => a.booking.status === "completed" || a.booking.status === "rated").length;
  const productivityScore = worker.assignments.length > 0
    ? (completed / worker.assignments.length) * 100
    : 75;

  // Customer score: from ratings
  const customerScore = avgRating;

  // Team score: placeholder (would come from peer reviews in production)
  const teamScore = 80;

  const overallScore = (
    0.25 * punctualityScore +
    0.30 * qualityScore +
    0.20 * productivityScore +
    0.15 * customerScore +
    0.10 * teamScore
  );

  // Trend: compare to previous period
  const prevPeriodDate = new Date(`${period}-01`);
  prevPeriodDate.setMonth(prevPeriodDate.getMonth() - 1);
  const prevPeriod = prevPeriodDate.toISOString().slice(0, 7);
  const prevScore = await db.workerPerformanceScore.findUnique({
    where: { workerId_period: { workerId, period: prevPeriod } },
  });
  let trend = "STABLE";
  if (prevScore) {
    if (overallScore > prevScore.overallScore + 3) trend = "UP";
    else if (overallScore < prevScore.overallScore - 3) trend = "DOWN";
  }

  const score = await db.workerPerformanceScore.upsert({
    where: { workerId_period: { workerId, period } },
    update: {
      overallScore,
      punctualityScore,
      qualityScore,
      productivityScore,
      customerScore,
      teamScore,
      trend,
      factorsJson: JSON.stringify({
        attendanceTotal: totalAttendance,
        ratingsCount: worker.ratings.length,
        auditsCount: worker.qualityAudits.length,
        completedJobs: completed,
        totalAssignments: worker.assignments.length,
      }),
      computedAt: new Date(),
    },
    create: {
      workerId, period, overallScore, punctualityScore, qualityScore, productivityScore, customerScore, teamScore, trend,
      factorsJson: JSON.stringify({
        attendanceTotal: totalAttendance,
        ratingsCount: worker.ratings.length,
        auditsCount: worker.qualityAudits.length,
        completedJobs: completed,
        totalAssignments: worker.assignments.length,
      }),
    },
  });

  await publish({ eventType: "workforce.performance_computed", payload: { workerId, period, overallScore, trend } });
  return score;
}

// ---------------------------------------------------------------------------
//  Workforce dashboard metrics
// ---------------------------------------------------------------------------

export async function workforceMetrics() {
  const [totalWorkers, activeWorkers, pendingTimeOff, scheduledToday, onLeaveToday, avgPerformance] = await Promise.all([
    db.worker.count({ where: { deletedAt: null } }),
    db.worker.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.timeOffRequest.count({ where: { status: "PENDING" } }),
    db.shiftSchedule.count({
      where: {
        date: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(23, 59, 59, 999)) },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
      },
    }),
    db.timeOffRequest.count({
      where: {
        status: "APPROVED",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    }),
    db.workerPerformanceScore.aggregate({ _avg: { overallScore: true } }),
  ]);
  return {
    totalWorkers,
    activeWorkers,
    pendingTimeOff,
    scheduledToday,
    onLeaveToday,
    avgPerformanceScore: avgPerformance._avg.overallScore ?? 0,
  };
}
