import { describe, it, expect } from "vitest";
import {
  checkRoutineConflict,
  checkCommitmentConflict,
  buildCandidateRoutine,
  buildCandidateCommitment,
} from "@/lib/schedule/services/ScheduleValidator";
import { normalizeNamingModel } from "@/lib/schedule/services/ScheduleMigrator";
import { SCHEMA_VERSION } from "@/lib/schedule/ports/ScheduleRepository";
import type { ScheduleData } from "@/lib/schedule/types";

function baseData(over: Partial<ScheduleData> = {}): ScheduleData {
  return {
    meta: {
      version: 3,
      owner: "T",
      cycle: { name: "C", number: 1, week: 1, progress: 0 },
      workdayStart: "09:00",
      workdayEnd: "18:00",
      enforceSleepBoundary: true,
      sleepSchedule: [{ start: "23:00", end: "07:00" }],
    },
    categories: [],
    routine: [],
    commitments: [],
    presets: [],
    suggestions: [],
    goals: [],
    ledger: { compositionScore: 0, metrics: [], scheduledHours: [] },
    progressSnapshots: [],
    ...over,
  } as unknown as ScheduleData;
}

/* ── ScheduleValidator ─────────────────────────────────────── */

describe("checkRoutineConflict", () => {
  const data = baseData({
    routine: [{ id: "r1", day: 1, kind: "deep", title: "Focus", start: "10:00", end: "11:00", endsNextDay: false }] as never,
  });

  it("detects an overlapping routine block on the same day", () => {
    const err = checkRoutineConflict(data, { day: 1, start: "10:30", end: "11:30", endsNextDay: false });
    expect(err).toContain("Focus");
  });

  it("allows an abutting (non-overlapping) block", () => {
    expect(checkRoutineConflict(data, { day: 1, start: "11:00", end: "12:00", endsNextDay: false })).toBeNull();
  });

  it("allows a block on a different day", () => {
    expect(checkRoutineConflict(data, { day: 2, start: "10:30", end: "11:30", endsNextDay: false })).toBeNull();
  });

  it("excludes the block being edited via excludeId", () => {
    expect(checkRoutineConflict(data, { day: 1, start: "10:00", end: "11:00", endsNextDay: false }, "r1")).toBeNull();
  });
});

describe("checkCommitmentConflict", () => {
  const data = baseData({
    commitments: [{ id: "c1", date: "2026-06-24", kind: "meeting", title: "Standup", start: "14:00", end: "15:00" }] as never,
  });

  it("detects an overlapping commitment on the same date", () => {
    const err = checkCommitmentConflict(data, { date: "2026-06-24", start: "14:30", end: "15:30" });
    expect(err).toContain("Standup");
  });

  it("allows a non-overlapping commitment", () => {
    expect(checkCommitmentConflict(data, { date: "2026-06-24", start: "15:00", end: "16:00" })).toBeNull();
  });

  it("returns null when the candidate has no date", () => {
    expect(checkCommitmentConflict(data, { date: "", start: "14:30", end: "15:30" })).toBeNull();
  });
});

describe("candidate builders infer endsNextDay", () => {
  it("flags a routine block that ends past midnight", () => {
    expect(buildCandidateRoutine({ day: 1, kind: "sleep", title: "x", start: "23:00", end: "01:00" } as never).endsNextDay).toBe(true);
    expect(buildCandidateRoutine({ day: 1, kind: "deep", title: "x", start: "10:00", end: "11:00" } as never).endsNextDay).toBe(false);
  });
  it("flags a commitment that ends past midnight", () => {
    expect(buildCandidateCommitment({ date: "2026-06-24", kind: "x", title: "y", start: "23:00", end: "00:30" } as never).endsNextDay).toBe(true);
  });
});

/* ── ScheduleMigrator: normalizeNamingModel ────────────────── */

describe("normalizeNamingModel", () => {
  const legacy = baseData({
    meta: {
      version: 3, owner: "T", cycle: { name: "C", number: 1, week: 1, progress: 0 },
      workdayStart: "09:00", workdayEnd: "18:00", focusCategoryIds: ["deep"],
    },
    categories: [
      { id: "deep", label: "Deep", tone: "sky", description: "d" },
      { id: "recovery", label: "Recovery", tone: "mint", description: "r" },
      { id: "admin", label: "Admin", tone: "amber", description: "a" },
    ],
    routine: [
      { id: "r1", day: 1, kind: "deep", title: "Focus", start: "10:00", end: "11:00" },
      { id: "legacy-sleep", day: 1, kind: "sleep", title: "Sleep", start: "23:00", end: "07:00" },
    ],
    goals: [
      { id: "g1", kind: "count", tracking: "x", period: "weekly", title: "Reps", target: 10, weight: 1 },
    ],
  } as never);

  const migrated = normalizeNamingModel(legacy, "en");

  it("derives category roles (focus / recovery / neutral)", () => {
    const byId = Object.fromEntries(migrated.categories.map((c) => [c.id, c.role]));
    expect(byId.deep).toBe("focus");
    expect(byId.recovery).toBe("recovery");
    expect(byId.admin).toBe("neutral");
  });

  it("strips legacy boundary sleep blocks from the routine", () => {
    expect(migrated.routine.some((r) => r.kind === "sleep")).toBe(false);
    expect(migrated.routine.some((r) => r.id === "r1")).toBe(true);
  });

  it("migrates legacy 'count' goals to 'numeric'", () => {
    expect(migrated.goals[0].kind).toBe("numeric");
  });

  it("stamps the current schema version", () => {
    expect(migrated.meta.version).toBe(SCHEMA_VERSION);
  });
});
