import { describe, it, expect } from "vitest";
import { runSafetyChecks, allSafetyChecksPass } from "@/lib/ai/tools/safety";
import {
  validateScheduleChange,
  checkFixedCommitmentOverlap,
  checkSleepOverlap,
  checkCategoryConsistency,
  checkRecoveryNotOverridden,
  checkUnfinishedPrograms,
  checkIncompleteSessions,
  checkChangeImpact,
} from "@/lib/ai/engine/scheduler";
import type {
  ScheduleContext,
  AiBlock,
  AiSleepBlock,
  AiCommitment,
  AiGoal,
  AiProgram,
  AiMetrics,
} from "@/lib/ai/context/ScheduleContext";

/* ── Fixture factories ─────────────────────────────────────── */

function block(over: Partial<AiBlock> & Pick<AiBlock, "id" | "start" | "end">): AiBlock {
  return {
    title: over.id,
    category: "deep",
    durationMin: 60,
    hasProgram: false,
    programProgress: { done: 0, total: 0 },
    inProgress: false,
    complete: false,
    source: "routine",
    ...over,
  } as AiBlock;
}

function sleep(start: string, end: string): AiSleepBlock {
  return { id: `sleep-${start}`, start, end, durationMin: 0, isSleepBoundary: true };
}

function commitment(
  over: Partial<AiCommitment> & Pick<AiCommitment, "id" | "start" | "end" | "commitmentType">,
): AiCommitment {
  return { title: over.id, category: "meeting", done: false, ...over } as AiCommitment;
}

function goal(categoryId: string, over: Partial<AiGoal> = {}): AiGoal {
  return {
    id: `goal-${categoryId}`,
    title: `Goal for ${categoryId}`,
    kind: "duration",
    tracking: "minutes",
    period: "weekly",
    categoryId,
    target: 100,
    weight: 1,
    progress: 0,
    streak: 0,
    ...over,
  } as AiGoal;
}

function program(over: Partial<AiProgram> & Pick<AiProgram, "done" | "total">): AiProgram {
  return {
    categoryId: "deep",
    categoryLabel: "Deep Work",
    templateName: "Course",
    ...over,
  } as AiProgram;
}

const ZERO_METRICS: AiMetrics = {
  compositionScore: 0,
  scheduledHours: [],
  focusTimeMin: 0,
  recoveryTimeMin: 0,
  consistencyScore: 0,
  overloadScore: 0,
};

function makeCtx(over: Partial<ScheduleContext> = {}): ScheduleContext {
  return {
    version: 1,
    generatedAt: "2026-06-24T00:00:00Z",
    owner: "Test",
    cycle: { name: "Cycle", number: 1, week: 1, progress: 0 },
    workday: { start: "09:00", end: "18:00" },
    blocks: [],
    sleep: { blocks: [], metrics: { averageDurationMin: 0, consistency: 0, debtMin: 0, schedule: [] } },
    commitments: [],
    goals: [],
    categories: [],
    programs: [],
    notes: [],
    metrics: { ...ZERO_METRICS },
    dailyStats: [],
    weeklyStats: [],
    historicalCompletion: [],
    autonomy: "balanced",
    ...over,
  };
}

/* ── Safety checks (tools/safety.ts) ───────────────────────── */

describe("runSafetyChecks — block mutations", () => {
  it("flags an overlap when a new block collides with an existing one", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00", title: "Focus" })] });
    const checks = runSafetyChecks(ctx, "createBlock", { start: "10:30", end: "11:30" });
    const overlap = checks.find((c) => c.check === "Prevent overlap creation")!;
    expect(overlap.passed).toBe(false);
    expect(overlap.detail).toContain("Focus");
    expect(allSafetyChecksPass(checks)).toBe(false);
  });

  it("passes when the new block does not overlap", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00" })] });
    const checks = runSafetyChecks(ctx, "createBlock", { start: "11:30", end: "12:30" });
    expect(checks.find((c) => c.check === "Prevent overlap creation")!.passed).toBe(true);
  });

  it("treats abutting blocks (end === start) as non-overlapping", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00" })] });
    const checks = runSafetyChecks(ctx, "createBlock", { start: "11:00", end: "12:00" });
    expect(allSafetyChecksPass(checks)).toBe(true);
  });

  it("flags overlap with a sleep window", () => {
    const ctx = makeCtx({
      blocks: [],
      sleep: { blocks: [sleep("13:00", "14:00")], metrics: { averageDurationMin: 0, consistency: 0, debtMin: 0, schedule: [] } },
    });
    const checks = runSafetyChecks(ctx, "createBlock", { start: "13:30", end: "13:45" });
    expect(checks.find((c) => c.check === "Prevent sleep removal")!.passed).toBe(false);
  });

  it("pushes no checks when start/end are missing", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00" })] });
    expect(runSafetyChecks(ctx, "createBlock", { start: "10:30" })).toHaveLength(0);
  });

  it("applies the same overlap guard to moveBlock and updateBlock", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00" })] });
    for (const action of ["moveBlock", "updateBlock"] as const) {
      const checks = runSafetyChecks(ctx, action, { start: "10:15", end: "10:45" });
      expect(checks.find((c) => c.check === "Prevent overlap creation")!.passed).toBe(false);
    }
  });
});

describe("runSafetyChecks — deletions", () => {
  it("protects recovery-category blocks from deletion", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "12:00", end: "13:00", category: "recovery" })] });
    const checks = runSafetyChecks(ctx, "deleteBlock", { blockId: "r1" });
    expect(checks.find((c) => c.check === "Prevent protected block deletion")!.passed).toBe(false);
  });

  it("protects commitment-sourced blocks from deletion", () => {
    const ctx = makeCtx({ blocks: [block({ id: "c1", start: "12:00", end: "13:00", source: "commitment" })] });
    const checks = runSafetyChecks(ctx, "deleteBlock", { blockId: "c1" });
    expect(checks.find((c) => c.check === "Prevent protected block deletion")!.passed).toBe(false);
  });

  it("allows deleting a normal routine block", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00", category: "deep" })] });
    const checks = runSafetyChecks(ctx, "deleteBlock", { blockId: "r1" });
    expect(checks.find((c) => c.check === "Prevent protected block deletion")!.passed).toBe(true);
    expect(allSafetyChecksPass(checks)).toBe(true);
  });

  it("warns about goal orphaning when a goal shares the block's category", () => {
    const ctx = makeCtx({
      blocks: [block({ id: "r1", start: "10:00", end: "11:00", category: "deep" })],
      goals: [goal("deep", { title: "Ship Portfolio" })],
    });
    const checks = runSafetyChecks(ctx, "deleteBlock", { blockId: "r1" });
    const orphan = checks.find((c) => c.check === "Prevent goal orphaning")!;
    expect(orphan).toBeDefined();
    expect(orphan.passed).toBe(false);
    expect(orphan.detail).toContain("Ship Portfolio");
  });

  it("pushes no checks for an unknown blockId", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00" })] });
    expect(runSafetyChecks(ctx, "deleteBlock", { blockId: "does-not-exist" })).toHaveLength(0);
  });
});

describe("runSafetyChecks — bulk operations & misc", () => {
  it("rejects optimize actions on an empty schedule", () => {
    const checks = runSafetyChecks(makeCtx({ blocks: [] }), "optimizeDay", {});
    expect(checks.find((c) => c.check === "Prevent invalid schedules")!.passed).toBe(false);
  });

  it("accepts optimize actions when blocks exist", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00" })] });
    expect(allSafetyChecksPass(runSafetyChecks(ctx, "optimizeWeek", {}))).toBe(true);
  });

  it("returns no checks for an unknown action", () => {
    expect(runSafetyChecks(makeCtx(), "frobnicate", {})).toHaveLength(0);
  });

  it("allSafetyChecksPass is true for an empty check list", () => {
    expect(allSafetyChecksPass([])).toBe(true);
  });
});

/* ── Scheduling engine (engine/scheduler.ts) ───────────────── */

describe("scheduler — individual rules", () => {
  it("checkFixedCommitmentOverlap fires only for fixed commitments", () => {
    const ctx = makeCtx({
      commitments: [
        commitment({ id: "m1", start: "10:00", end: "11:00", commitmentType: "fixed", title: "Standup" }),
        commitment({ id: "m2", start: "14:00", end: "15:00", commitmentType: "flexible", title: "Errand" }),
      ],
    });
    expect(checkFixedCommitmentOverlap(ctx, "10:30", "11:30", "deep")!.severity).toBe("error");
    // Overlaps the flexible one only → no violation (flexible is movable)
    expect(checkFixedCommitmentOverlap(ctx, "14:30", "14:45", "deep")).toBeNull();
  });

  it("checkFixedCommitmentOverlap ignores an abutting fixed commitment", () => {
    const ctx = makeCtx({
      commitments: [commitment({ id: "m1", start: "10:00", end: "11:00", commitmentType: "fixed" })],
    });
    expect(checkFixedCommitmentOverlap(ctx, "11:00", "12:00", "deep")).toBeNull();
  });

  it("checkSleepOverlap returns an error on overlap", () => {
    const ctx = makeCtx({
      sleep: { blocks: [sleep("22:00", "23:30")], metrics: { averageDurationMin: 0, consistency: 0, debtMin: 0, schedule: [] } },
    });
    expect(checkSleepOverlap(ctx, "23:00", "23:15")!.severity).toBe("error");
    expect(checkSleepOverlap(ctx, "20:00", "21:00")).toBeNull();
  });

  it("checkCategoryConsistency warns on an undefined category", () => {
    const ctx = makeCtx({ categories: [{ id: "deep", label: "Deep", description: "", hasProgram: false, programCount: 0, weeklyBlockCount: 0 }] });
    expect(checkCategoryConsistency(ctx, "ghost")!.severity).toBe("warning");
    expect(checkCategoryConsistency(ctx, "deep")).toBeNull();
  });

  it("checkRecoveryNotOverridden warns when recovery is already scarce", () => {
    const ctx = makeCtx({
      blocks: [block({ id: "r1", start: "09:00", end: "19:00", durationMin: 600 })],
      metrics: { ...ZERO_METRICS, recoveryTimeMin: 0 },
    });
    expect(checkRecoveryNotOverridden(ctx, 100)!.severity).toBe("warning");
  });

  it("checkRecoveryNotOverridden stays quiet when recovery is healthy", () => {
    const ctx = makeCtx({
      blocks: [block({ id: "r1", start: "09:00", end: "19:00", durationMin: 600 })],
      metrics: { ...ZERO_METRICS, recoveryTimeMin: 120 },
    });
    expect(checkRecoveryNotOverridden(ctx, 100)).toBeNull();
  });

  it("checkUnfinishedPrograms flags only started-but-incomplete programs", () => {
    const ctx = makeCtx({
      programs: [
        program({ done: 2, total: 5 }), // incomplete, never used → flagged
        program({ done: 5, total: 5 }), // complete → ignored
        program({ done: 1, total: 4, lastUsed: "2026-06-20" }), // recently used → ignored
      ],
    });
    const violations = checkUnfinishedPrograms(ctx);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("Continue unfinished programs");
  });

  it("checkIncompleteSessions flags in-progress, not-complete blocks", () => {
    const ctx = makeCtx({
      blocks: [
        block({ id: "r1", start: "10:00", end: "11:00", inProgress: true, complete: false }),
        block({ id: "r2", start: "11:00", end: "12:00", inProgress: false, complete: false }),
      ],
    });
    expect(checkIncompleteSessions(ctx)).toHaveLength(1);
  });

  it("checkChangeImpact warns past a 50% churn threshold", () => {
    expect(checkChangeImpact(10, 16)!.severity).toBe("warning");
    expect(checkChangeImpact(10, 12)).toBeNull();
  });
});

describe("scheduler — validateScheduleChange aggregation", () => {
  it("returns no violations for a clean proposal against a clean context", () => {
    const ctx = makeCtx({ categories: [{ id: "deep", label: "Deep", description: "", hasProgram: false, programCount: 0, weeklyBlockCount: 0 }] });
    expect(validateScheduleChange(ctx, { start: "10:00", end: "11:00", category: "deep" })).toHaveLength(0);
  });

  it("collects both fixed-commitment and sleep errors for a conflicting proposal", () => {
    const ctx = makeCtx({
      commitments: [commitment({ id: "m1", start: "13:00", end: "14:00", commitmentType: "fixed" })],
      sleep: { blocks: [sleep("13:30", "14:30")], metrics: { averageDurationMin: 0, consistency: 0, debtMin: 0, schedule: [] } },
    });
    const violations = validateScheduleChange(ctx, { start: "13:15", end: "13:45" });
    const errors = violations.filter((v) => v.severity === "error");
    expect(errors).toHaveLength(2);
  });

  it("surfaces program and session warnings even without a time proposal", () => {
    const ctx = makeCtx({
      blocks: [block({ id: "r1", start: "10:00", end: "11:00", inProgress: true, complete: false })],
      programs: [program({ done: 1, total: 3 })],
    });
    const violations = validateScheduleChange(ctx, {});
    expect(violations.some((v) => v.rule === "Continue unfinished programs")).toBe(true);
    expect(violations.some((v) => v.rule === "Prioritize incomplete sessions")).toBe(true);
  });
});
