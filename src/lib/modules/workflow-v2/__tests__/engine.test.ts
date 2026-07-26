/**
 * Workflow Engine v2 — pure-logic unit tests
 *  - Worker-task matching, validation
 */
import { describe, it, expect } from "bun:test";

// Mirror of canWorkerPerformTask logic
interface WorkerSkill { skillCode: string; proficiency: string }
interface SkillAssessment { skill: { code: string }; level: number }
interface RequiredSkill { skillCode: string; minLevel: number }

function proficiencyToLevel(p: string): number {
  return p === "EXPERT" ? 4 : p === "ADVANCED" ? 3 : p === "INTERMEDIATE" ? 2 : p === "BEGINNER" ? 1 : 0;
}

function checkWorkerSkills(workerSkills: WorkerSkill[], assessments: SkillAssessment[], required: RequiredSkill[]): { canPerform: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const req of required) {
    const ws = workerSkills.find(s => s.skillCode === req.skillCode);
    const assessment = assessments.find(a => a.skill.code === req.skillCode);
    const level = ws ? proficiencyToLevel(ws.proficiency) : assessment?.level ?? 0;
    if (level < req.minLevel) {
      missing.push(`${req.skillCode} (need ${req.minLevel}, have ${level})`);
    }
  }
  return { canPerform: missing.length === 0, missing };
}

describe("Workflow v2 — worker-task matching", () => {
  it("allows worker with sufficient skill level", () => {
    const result = checkWorkerSkills(
      [{ skillCode: "MARBLE", proficiency: "EXPERT" }],
      [],
      [{ skillCode: "MARBLE", minLevel: 3 }],
    );
    expect(result.canPerform).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("blocks worker with insufficient skill level", () => {
    const result = checkWorkerSkills(
      [{ skillCode: "MARBLE", proficiency: "BEGINNER" }],
      [],
      [{ skillCode: "MARBLE", minLevel: 3 }],
    );
    expect(result.canPerform).toBe(false);
    expect(result.missing).toHaveLength(1);
  });

  it("uses assessment level when no WorkerSkill exists", () => {
    const result = checkWorkerSkills(
      [],
      [{ skill: { code: "CARPET" }, level: 4 }],
      [{ skillCode: "CARPET", minLevel: 3 }],
    );
    expect(result.canPerform).toBe(true);
  });

  it("reports all missing skills", () => {
    const result = checkWorkerSkills(
      [{ skillCode: "A", proficiency: "EXPERT" }],
      [],
      [{ skillCode: "A", minLevel: 3 }, { skillCode: "B", minLevel: 2 }, { skillCode: "C", minLevel: 4 }],
    );
    expect(result.canPerform).toBe(false);
    expect(result.missing).toHaveLength(2);
    expect(result.missing).toContain("B (need 2, have 0)");
  });
});
