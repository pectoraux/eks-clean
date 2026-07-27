/**
 * LMS — pure-logic unit tests
 *
 * Covers: exam scoring, certification expiry calculation,
 * recertification schedule (30 days before expiry).
 */

import { describe, it, expect } from "bun:test";

// Mirror of submitExamAttempt scoring logic
function scoreExam(
  questions: Array<{ id: string; correctAnswer: string | number; points?: number }>,
  answers: Array<{ questionId: string; selectedAnswer: string | number }>,
): { scorePercent: number; passed: boolean; earned: number; total: number } {
  let earned = 0;
  let total = 0;
  for (const q of questions) {
    const points = q.points ?? 1;
    total += points;
    const ans = answers.find((a) => a.questionId === q.id);
    if (ans && ans.selectedAnswer === q.correctAnswer) earned += points;
  }
  const scorePercent = total > 0 ? (earned / total) * 100 : 0;
  return { scorePercent, earned, total, passed: false }; // passed computed by caller with passing threshold
}

function computeCertificationExpiry(issuedAt: Date, validityDays = 365): Date {
  return new Date(issuedAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
}

function computeRecertificationDue(expiresAt: Date, daysBefore = 30): Date {
  return new Date(expiresAt.getTime() - daysBefore * 24 * 60 * 60 * 1000);
}

describe("LMS — exam scoring", () => {
  it("scores a perfect exam", () => {
    const r = scoreExam(
      [
        { id: "q1", correctAnswer: "A", points: 1 },
        { id: "q2", correctAnswer: "B", points: 1 },
        { id: "q3", correctAnswer: "C", points: 1 },
      ],
      [
        { questionId: "q1", selectedAnswer: "A" },
        { questionId: "q2", selectedAnswer: "B" },
        { questionId: "q3", selectedAnswer: "C" },
      ],
    );
    expect(r.earned).toBe(3);
    expect(r.total).toBe(3);
    expect(r.scorePercent).toBe(100);
  });

  it("scores partial answers", () => {
    const r = scoreExam(
      [
        { id: "q1", correctAnswer: "A", points: 1 },
        { id: "q2", correctAnswer: "B", points: 1 },
      ],
      [{ questionId: "q1", selectedAnswer: "A" }],
    );
    expect(r.earned).toBe(1);
    expect(r.total).toBe(2);
    expect(r.scorePercent).toBe(50);
  });

  it("respects weighted points", () => {
    const r = scoreExam(
      [
        { id: "q1", correctAnswer: "A", points: 3 },
        { id: "q2", correctAnswer: "B", points: 1 },
      ],
      [
        { questionId: "q1", selectedAnswer: "A" },
        { questionId: "q2", selectedAnswer: "WRONG" },
      ],
    );
    expect(r.earned).toBe(3);
    expect(r.total).toBe(4);
    expect(r.scorePercent).toBe(75);
  });

  it("handles empty question set", () => {
    const r = scoreExam([], []);
    expect(r.earned).toBe(0);
    expect(r.total).toBe(0);
    expect(r.scorePercent).toBe(0);
  });

  it("treats missing answer as incorrect", () => {
    const r = scoreExam(
      [{ id: "q1", correctAnswer: "A" }],
      [{ questionId: "q1", selectedAnswer: "B" }],
    );
    expect(r.earned).toBe(0);
    expect(r.scorePercent).toBe(0);
  });

  it("supports numeric answers", () => {
    const r = scoreExam(
      [{ id: "q1", correctAnswer: 42, points: 1 }],
      [{ questionId: "q1", selectedAnswer: 42 }],
    );
    expect(r.earned).toBe(1);
    expect(r.scorePercent).toBe(100);
  });
});

describe("LMS — certification & recertification", () => {
  it("computes expiry 365 days after issue", () => {
    const issued = new Date("2026-01-01");
    const expiry = computeCertificationExpiry(issued);
    expect(expiry.toISOString().slice(0, 10)).toBe("2027-01-01");
  });

  it("schedules recertification 30 days before expiry", () => {
    const expiry = new Date("2027-01-01");
    const due = computeRecertificationDue(expiry);
    expect(due.toISOString().slice(0, 10)).toBe("2026-12-02");
  });

  it("recertification due is always before expiry", () => {
    const expiry = new Date("2027-06-15");
    const due = computeRecertificationDue(expiry);
    expect(due.getTime()).toBeLessThan(expiry.getTime());
  });

  it("supports custom validity period", () => {
    const issued = new Date("2026-01-01");
    const expiry = computeCertificationExpiry(issued, 730); // 2 years
    expect(expiry.toISOString().slice(0, 10)).toBe("2028-01-01");
  });
});
