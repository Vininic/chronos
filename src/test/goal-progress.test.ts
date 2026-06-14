import { describe, it, expect } from "vitest";
import {
  computeGoalProgress,
  computeStreak,
  daysUntilDeadline,
  getPeriodStartEnd,
  isGoalTrackingValid,
  isGoalPeriodValid,
  getValidGoalPeriods,
  getDefaultGoalTracking,
  getDefaultGoalPeriod,
  GOAL_TRACKING_BY_KIND,
  type Goal,
  type RoutineBlock,
  type Commitment,
} from "@/lib/schedule/types";

function goal(overrides: Partial<Goal> = {}): Goal {
  const now = new Date().toISOString().slice(0, 10);
  return {
    id: "test-g",
    kind: "numeric",
    tracking: "goalBlock",
    title: "Test goal",
    target: 10,
    period: "daily",
    startDate: now,
    weight: 5,
    blocks: [],
    subTasks: [],
    looseCommitmentIds: [],
    createdAt: now,
    ...overrides,
  };
}

function d(dateStr: string): string {
  return dateStr;
}

describe("GOAL_TRACKING_BY_KIND", () => {
  it("should have valid tracking for numeric", () => {
    expect(GOAL_TRACKING_BY_KIND.numeric).toEqual(["goalBlock", "subTask", "category"]);
  });
  it("should have valid tracking for duration", () => {
    expect(GOAL_TRACKING_BY_KIND.duration).toEqual(["quota", "category"]);
  });
  it("should have valid tracking for deadline", () => {
    expect(GOAL_TRACKING_BY_KIND.deadline).toEqual(["none", "goalBlock", "subTask", "category"]);
  });
});

describe("isGoalTrackingValid", () => {
  it("should accept valid combinations", () => {
    expect(isGoalTrackingValid("numeric", "goalBlock")).toBe(true);
    expect(isGoalTrackingValid("numeric", "subTask")).toBe(true);
    expect(isGoalTrackingValid("duration", "quota")).toBe(true);
    expect(isGoalTrackingValid("deadline", "none")).toBe(true);
  });
  it("should reject invalid combinations", () => {
    expect(isGoalTrackingValid("numeric", "quota")).toBe(false);
    expect(isGoalTrackingValid("duration", "goalBlock")).toBe(false);
    expect(isGoalTrackingValid("duration", "none")).toBe(false);
    expect(isGoalTrackingValid("deadline", "quota")).toBe(false);
  });
});

describe("getDefaultGoalTracking", () => {
  it("should return first valid tracking for each kind", () => {
    expect(getDefaultGoalTracking("numeric")).toBe("goalBlock");
    expect(getDefaultGoalTracking("duration")).toBe("quota");
    expect(getDefaultGoalTracking("deadline")).toBe("none");
  });
});

describe("getValidGoalPeriods", () => {
  it("should restrict deadline to total only", () => {
    expect(getValidGoalPeriods("deadline", "goalBlock")).toEqual(["total"]);
    expect(getValidGoalPeriods("deadline", "none")).toEqual(["total"]);
    expect(getValidGoalPeriods("deadline", "subTask")).toEqual(["total"]);
    expect(getValidGoalPeriods("deadline", "category")).toEqual(["total"]);
  });
  it("should restrict subTask to total only", () => {
    expect(getValidGoalPeriods("numeric", "subTask")).toEqual(["total"]);
  });
  it("should allow all periods for unconstrained combos", () => {
    expect(getValidGoalPeriods("numeric", "goalBlock")).toEqual(["daily", "weekly", "monthly", "total"]);
    expect(getValidGoalPeriods("duration", "quota")).toEqual(["daily", "weekly", "monthly", "total"]);
  });
});

describe("getDefaultGoalPeriod", () => {
  it("should return total for deadline or subTask", () => {
    expect(getDefaultGoalPeriod("deadline", "none")).toBe("total");
    expect(getDefaultGoalPeriod("deadline", "goalBlock")).toBe("total");
    expect(getDefaultGoalPeriod("numeric", "subTask")).toBe("total");
  });
  it("should return weekly for duration", () => {
    expect(getDefaultGoalPeriod("duration", "quota")).toBe("weekly");
    expect(getDefaultGoalPeriod("duration", "category")).toBe("weekly");
  });
  it("should return daily for numeric", () => {
    expect(getDefaultGoalPeriod("numeric", "goalBlock")).toBe("daily");
  });
});

describe("isGoalPeriodValid", () => {
  it("should validate period against kind+tracking", () => {
    expect(isGoalPeriodValid("numeric", "goalBlock", "daily")).toBe(true);
    expect(isGoalPeriodValid("numeric", "goalBlock", "total")).toBe(true);
    expect(isGoalPeriodValid("deadline", "goalBlock", "daily")).toBe(false);
    expect(isGoalPeriodValid("deadline", "goalBlock", "total")).toBe(true);
    expect(isGoalPeriodValid("numeric", "subTask", "weekly")).toBe(false);
    expect(isGoalPeriodValid("numeric", "subTask", "total")).toBe(true);
  });
});

describe("daysUntilDeadline", () => {
  it("should return positive for future deadline", () => {
    expect(daysUntilDeadline("2027-01-01")).toBeGreaterThan(0);
  });

  it("should return 0 for today", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    expect(daysUntilDeadline(`${y}-${m}-${d}`)).toBe(0);
  });

  it("should return negative for past deadline", () => {
    expect(daysUntilDeadline("2025-01-01")).toBeLessThan(0);
  });

  it("should return exact difference", () => {
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 12);
    const yF = future.getFullYear();
    const mF = String(future.getMonth() + 1).padStart(2, "0");
    const dF = String(future.getDate()).padStart(2, "0");
    expect(daysUntilDeadline(`${yF}-${mF}-${dF}`)).toBe(12);
    const past = new Date(today);
    past.setDate(past.getDate() - 9);
    const yP = past.getFullYear();
    const mP = String(past.getMonth() + 1).padStart(2, "0");
    const dP = String(past.getDate()).padStart(2, "0");
    expect(daysUntilDeadline(`${yP}-${mP}-${dP}`)).toBe(-9);
  });
});

describe("getPeriodStartEnd", () => {
  it("should return same day for daily period", () => {
    const p = getPeriodStartEnd("2026-01-01", "daily", "2026-06-10");
    expect(p).toEqual({ start: "2026-06-10", end: "2026-06-10" });
  });

  it("should return correct week range for weekly period", () => {
    const p = getPeriodStartEnd("2026-01-05", "weekly", "2026-06-10");
    expect(p.start).toBe("2026-06-08");
    expect(p.end).toBe("2026-06-14");
  });

  it("should return correct month range for monthly period", () => {
    const p = getPeriodStartEnd("2026-01-15", "monthly", "2026-06-20");
    expect(p.start).toBe("2026-06-15");
    expect(p.end).toBe("2026-07-14");
  });

  it("should return start to far future for total period", () => {
    const p = getPeriodStartEnd("2026-03-01", "total", "2026-06-10");
    expect(p.start).toBe("2026-03-01");
    expect(p.end).toBe("9999-12-31");
  });
});

describe("computeGoalProgress", () => {
  const today = "2026-06-10";
  const yesterday = "2026-06-09";

  describe("numeric + goalBlock + daily", () => {
    it("should count done blocks in period", () => {
      const g = goal({
        kind: "numeric",
        tracking: "goalBlock",
        period: "daily",
        target: 5,
        blocks: [
          { id: "b1", goalId: "test-g", title: "", duration: 30, date: today, time: "09:00", done: true, order: 0 },
          { id: "b2", goalId: "test-g", title: "", duration: 30, date: today, time: "10:00", done: true, order: 1 },
          { id: "b3", goalId: "test-g", title: "", duration: 30, date: today, time: "11:00", done: false, order: 2 },
        ],
      });
      const p = computeGoalProgress(g, today);
      expect(p.numerator).toBe(2);
      expect(p.denominator).toBe(5);
      expect(p.ratio).toBe(0.4);
    });

    it("should not count blocks from other days", () => {
      const g = goal({
        kind: "numeric",
        tracking: "goalBlock",
        period: "daily",
        target: 5,
        blocks: [
          { id: "b1", goalId: "test-g", title: "", duration: 30, date: yesterday, time: "09:00", done: true, order: 0 },
        ],
      });
      const p = computeGoalProgress(g, today);
      expect(p.numerator).toBe(0);
    });
  });

  describe("numeric + subTask + total", () => {
    it("should count done subtasks", () => {
      const g = goal({
        kind: "numeric",
        tracking: "subTask",
        period: "total",
        subTasks: [
          { id: "st1", title: "Step 1", done: true },
          { id: "st2", title: "Step 2", done: true },
          { id: "st3", title: "Step 3", done: false },
        ],
      });
      const p = computeGoalProgress(g, today);
      expect(p.numerator).toBe(2);
      expect(p.denominator).toBe(3);
      expect(p.ratio).toBeCloseTo(0.666, 2);
    });

    it("should return 0/0 when no subtasks", () => {
      const g = goal({
        kind: "numeric",
        tracking: "subTask",
        period: "total",
        subTasks: [],
      });
      const p = computeGoalProgress(g, today);
      expect(p.numerator).toBe(0);
      expect(p.denominator).toBe(0);
      expect(p.ratio).toBe(0);
    });
  });

  describe("numeric + category + daily (always)", () => {
    const routine: RoutineBlock[] = [
      { id: "r1", day: 3, start: "09:00", end: "11:00", kind: "deep", title: "Deep work" },
    ];

    it("should count routine occurrences for always mode", () => {
      const g = goal({
        kind: "numeric",
        tracking: "category",
        period: "daily",
        target: 3,
        categoryId: "deep",
        startDate: "2026-06-01",
        blocks: [],
      });
      // Use a known day 3 (Wednesday) — 2026-06-03 is a Wednesday
      const p = computeGoalProgress(g, "2026-06-03", undefined, routine, []);
      expect(p.denominator).toBe(3);
      expect(p.numerator).toBeGreaterThanOrEqual(1);
    });
  });

  describe("duration + quota + weekly", () => {
    it("should sum block durations in period", () => {
      // A week starting 2026-06-08 (Monday) to 2026-06-14 (Sunday)
      const g = goal({
        kind: "duration",
        tracking: "quota",
        period: "weekly",
        target: 300, // 5 hours in minutes
        startDate: "2026-06-08",
        blocks: [
          { id: "b1", goalId: "test-g", title: "", duration: 90, date: "2026-06-09", time: "09:00", done: true, order: 0 },
          { id: "b2", goalId: "test-g", title: "", duration: 120, date: "2026-06-10", time: "10:00", done: true, order: 1 },
        ],
      });
      const p = computeGoalProgress(g, "2026-06-10");
      expect(p.numerator).toBe(210); // 90 + 120 minutes
      expect(p.denominator).toBe(300);
      expect(p.ratio).toBe(0.7);
    });
  });

  describe("duration + category + weekly (always)", () => {
    const routine: RoutineBlock[] = [
      { id: "r-deep", day: 1, start: "09:00", end: "11:00", kind: "deep", title: "Deep work" },
      { id: "r-deep-2", day: 3, start: "14:00", end: "15:30", kind: "deep", title: "Arch review" },
    ];

    it("should accumulate real minutes for duration kind (not flat 60)", () => {
      const g = goal({
        kind: "duration",
        tracking: "category",
        period: "weekly",
        target: 600,
        categoryId: "deep",
        startDate: "2026-06-08",
        blocks: [
          { id: "b1", goalId: "test-g", title: "", duration: 45, date: "2026-06-09", time: "09:00", done: true, order: 0 },
        ],
      });
      const p = computeGoalProgress(g, "2026-06-10", undefined, routine, []);
      // Total minutes: 120 (Mon deep) + 90 (Wed arch review) + 45 (block) = 255
      expect(p.numerator).toBe(255);
      expect(p.denominator).toBe(600);
    });
  });

  describe("deadline + none + total", () => {
    it("should complete when deadline is reached", () => {
      const g = goal({
        kind: "deadline",
        tracking: "none",
        period: "total",
        deadline: "2026-06-10",
        startDate: "2026-01-01",
      });
      expect(computeGoalProgress(g, "2026-06-10").ratio).toBe(1);
      expect(computeGoalProgress(g, "2026-06-11").ratio).toBe(1);
    });

    it("should show incomplete before deadline", () => {
      const g = goal({
        kind: "deadline",
        tracking: "none",
        period: "total",
        deadline: "2026-06-15",
        startDate: "2026-01-01",
      });
      expect(computeGoalProgress(g, "2026-06-10").ratio).toBe(0);
    });
  });

  describe("deadline + goalBlock + total", () => {
    it("should count blocks done before deadline", () => {
      const today = "2026-06-10";
      const g = goal({
        kind: "deadline",
        tracking: "goalBlock",
        period: "total",
        target: 5,
        deadline: "2026-06-15",
        startDate: "2026-06-01",
        blocks: [
          { id: "b1", goalId: "test-g", title: "", duration: 30, date: "2026-06-05", time: "09:00", done: true, order: 0 },
          { id: "b2", goalId: "test-g", title: "", duration: 30, date: "2026-06-08", time: "10:00", done: true, order: 1 },
        ],
      });
      const p = computeGoalProgress(g, today);
      expect(p.numerator).toBe(2);
      expect(p.denominator).toBe(5);
    });
  });

  describe("deadline + subTask + total", () => {
    it("should count done subtasks", () => {
      const g = goal({
        kind: "deadline",
        tracking: "subTask",
        period: "total",
        deadline: "2026-06-15",
        subTasks: [
          { id: "st1", title: "A", done: true },
          { id: "st2", title: "B", done: false },
        ],
      });
      const p = computeGoalProgress(g, "2026-06-10");
      expect(p.numerator).toBe(1);
      expect(p.denominator).toBe(2);
      expect(p.ratio).toBe(0.5);
    });
  });

  describe("deadline + category + total (always)", () => {
    const routine: RoutineBlock[] = [
      { id: "r-deep", day: 1, start: "09:00", end: "11:00", kind: "deep", title: "Deep work" },
    ];

    it("should count category blocks up to deadline capping", () => {
      const g = goal({
        kind: "deadline",
        tracking: "category",
        period: "total",
        target: 10,
        categoryId: "deep",
        deadline: "2026-06-08",
        startDate: "2026-06-01",
        blocks: [
          { id: "b1", goalId: "test-g", title: "", duration: 60, date: "2026-06-07", done: true, order: 0 },
          { id: "b2", goalId: "test-g", title: "", duration: 60, date: "2026-06-10", done: true, order: 1 },
        ],
      });
      // deadline 2026-06-08, observed period end = min(2026-06-10, 2026-06-08) = 2026-06-08
      // b1 is before observed end, b2 is after observed end
      const p = computeGoalProgress(g, "2026-06-10", undefined, routine, []);
      // Jun 7 is a Sunday, so Mon routine (day 1) doesn't fall in observed period (Jun 1 - Jun 8)
      // Actually Jun 7 is Sunday, Jun 8 is Monday — wait let me check
      // 2026-06-01 is a Monday. Jun 1, Jun 8 are both Mondays.
      // observedPeriodEnd = min("2026-06-10", "2026-06-08") = "2026-06-08"
      // observedPeriod = { start: "2026-06-01", end: "2026-06-08" }
      // routine day 1 (Monday) falls on Jun 1 and Jun 8 within observed period = 2 occurrences
      // blocks: b1 (Jun 7, done) in period + b2 (Jun 10, done) NOT in period (after Jun 8)
      const mondayRoutines = 2; // Jun 1 and Jun 8
      expect(p.numerator).toBe(mondayRoutines + 1); // 2 routines + 1 block in period
      expect(p.denominator).toBe(10);
      expect(p.numerator).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("should return 0/0 when denominator is 0", () => {
      const g = goal({ target: 0, tracking: "goalBlock", blocks: [] });
      const p = computeGoalProgress(g, "2026-06-10");
      expect(p.numerator).toBe(0);
      expect(p.denominator).toBe(0);
      expect(p.ratio).toBe(0);
    });

    it("should cap ratio at 1", () => {
      const g = goal({
        tracking: "goalBlock",
        target: 3,
        blocks: [
          { id: "b1", goalId: "test-g", title: "", duration: 30, date: "2026-06-10", time: "09:00", done: true, order: 0 },
          { id: "b2", goalId: "test-g", title: "", duration: 30, date: "2026-06-10", time: "10:00", done: true, order: 1 },
          { id: "b3", goalId: "test-g", title: "", duration: 30, date: "2026-06-10", time: "11:00", done: true, order: 2 },
          { id: "b4", goalId: "test-g", title: "", duration: 30, date: "2026-06-10", time: "12:00", done: true, order: 3 },
        ],
      });
      const p = computeGoalProgress(g, "2026-06-10");
      expect(p.numerator).toBe(4);
      expect(p.ratio).toBe(1);
    });
  });

  describe("category with commitments mode", () => {
    it("should count completed commitments", () => {
      const g = goal({
        kind: "numeric",
        tracking: "category",
        period: "daily",
        target: 3,
        categoryId: "deep",
        autoTrackMode: "commitments",
        looseCommitmentIds: ["c1", "c2"],
        startDate: "2026-06-01",
      });
      const commitments: Commitment[] = [
        {
          id: "c1", date: "2026-06-10", start: "09:00", end: "10:00",
          kind: "deep", title: "CMT 1", createdAt: "2026-06-01", priority: "low",
        },
        {
          id: "c2", date: "2026-06-10", start: "10:00", end: "11:00",
          kind: "deep", title: "CMT 2", createdAt: "2026-06-01", priority: "low",
        },
      ];
      // Both commitments have ended (past time), so should be counted
      const p = computeGoalProgress(g, "2026-06-10", undefined, undefined, commitments);
      expect(p.numerator).toBe(2);
      expect(p.denominator).toBe(3);
      expect(p.ratio).toBeCloseTo(0.666, 2);
    });
  });
});

describe("computeStreak", () => {
  it("should return 0 for total period goals", () => {
    const g = goal({ period: "total", tracking: "subTask" });
    expect(computeStreak(g, "2026-06-10")).toBe(0);
  });

  it("should count consecutive days with ratio >= 1", () => {
    const today = "2026-06-10";
    const start = "2026-06-01";
    const blocks = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date("2026-06-10");
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      blocks.push(
        { id: `b${i}a`, goalId: "test-g", title: "", duration: 30, date: iso, time: "09:00", done: true, order: 0 },
        { id: `b${i}b`, goalId: "test-g", title: "", duration: 30, date: iso, time: "10:00", done: true, order: 1 },
        { id: `b${i}c`, goalId: "test-g", title: "", duration: 30, date: iso, time: "11:00", done: true, order: 2 },
      );
    }
    const g = goal({
      kind: "numeric",
      tracking: "goalBlock",
      period: "daily",
      target: 3,
      startDate: start,
      blocks,
    });
    expect(computeStreak(g, today)).toBe(3);
  });

  it("should break streak when a day is incomplete", () => {
    const today = "2026-06-10";
    const blocks = [];
    // Jun 10 - complete (3/3)
    blocks.push(
      { id: "b0a", goalId: "test-g", title: "", duration: 30, date: "2026-06-10", time: "09:00", done: true, order: 0 },
      { id: "b0b", goalId: "test-g", title: "", duration: 30, date: "2026-06-10", time: "10:00", done: true, order: 1 },
      { id: "b0c", goalId: "test-g", title: "", duration: 30, date: "2026-06-10", time: "11:00", done: true, order: 2 },
    );
    // Jun 9 - complete
    blocks.push(
      { id: "b1a", goalId: "test-g", title: "", duration: 30, date: "2026-06-09", time: "09:00", done: true, order: 0 },
      { id: "b1b", goalId: "test-g", title: "", duration: 30, date: "2026-06-09", time: "10:00", done: true, order: 1 },
      { id: "b1c", goalId: "test-g", title: "", duration: 30, date: "2026-06-09", time: "11:00", done: true, order: 2 },
    );
    // Jun 8 - incomplete (only 1/3)
    blocks.push(
      { id: "b2a", goalId: "test-g", title: "", duration: 30, date: "2026-06-08", time: "09:00", done: true, order: 0 },
    );
    const g = goal({
      kind: "numeric",
      tracking: "goalBlock",
      period: "daily",
      target: 3,
      startDate: "2026-06-01",
      blocks,
    });
    expect(computeStreak(g, today)).toBe(2);
  });
});

describe("getPeriodStartEnd", () => {
  it("should handle monthly period mid-month start date", () => {
    // start day is 15, today is Feb 20 (past the 15th), so current period is Feb 15 → Mar 14
    const p = getPeriodStartEnd("2026-01-15", "monthly", "2026-02-20");
    expect(p.start).toBe("2026-02-15");
    expect(p.end).toBe("2026-03-14");
  });

  it("should handle weekly reset on Monday start", () => {
    // Jan 5 2026 is a Monday
    const p = getPeriodStartEnd("2026-01-05", "weekly", "2026-06-10");
    // June 10 is a Wednesday, so week start is Monday June 8
    expect(p.start).toBe("2026-06-08");
    expect(p.end).toBe("2026-06-14");
  });

  it("should handle total period start date", () => {
    const p = getPeriodStartEnd("2026-01-01", "total", "2026-06-10");
    expect(p.start).toBe("2026-01-01");
  });
});

describe("computeGoalProgress — total period with observedPeriodEnd", () => {
  it("should cap total period at deadline for deadline goals", () => {
    const g = goal({
      kind: "deadline",
      tracking: "goalBlock",
      period: "total",
      target: 5,
      deadline: "2026-06-08",
      startDate: "2026-06-01",
      blocks: [
        { id: "b1", goalId: "test-g", title: "", duration: 30, date: "2026-06-09", time: "10:00", done: true, order: 0 },
      ],
    });
    // deadline is 2026-06-08, today is 2026-06-10
    // observedPeriodEnd = min("2026-06-10", "2026-06-08") = "2026-06-08"
    // block on 2026-06-09 is AFTER observedPeriodEnd, so it shouldn't count
    const p = computeGoalProgress(g, "2026-06-10");
    expect(p.numerator).toBe(0);
  });

  it("should cap total period at today for non-deadline total goals", () => {
    const g = goal({
      kind: "numeric",
      tracking: "goalBlock",
      period: "total",
      target: 10,
      startDate: "2026-01-01",
      blocks: [
        { id: "b1", goalId: "test-g", title: "", duration: 30, date: "2026-06-10", done: true, order: 0 },
        { id: "b2", goalId: "test-g", title: "", duration: 30, date: "2026-06-11", done: true, order: 1 },
      ],
    });
    // today = "2026-06-10", observedPeriodEnd = min("9999-12-31", "2026-06-10") = "2026-06-10"
    const p = computeGoalProgress(g, "2026-06-10");
    expect(p.numerator).toBe(1); // only b1 is within observedPeriodEnd
  });
});
