import { describe, it, expect } from "vitest";
import {
  buildDigestContext,
  rangeForTimeframe,
  totalMinutes,
  minutesByCategory,
  recoveryKindSet,
  isFocusKind,
  categoryLabel,
} from "@/lib/digest/modules/helpers";
import { recoveryAnalysis } from "@/lib/digest/modules/recovery";
import { productivityAnalysis } from "@/lib/digest/modules/productivity";
import { scheduleQualityAnalysis } from "@/lib/digest/modules/schedule-quality";
import { goalAlignmentAnalysis } from "@/lib/digest/modules/goal-alignment";
import { consistencyAnalysis } from "@/lib/digest/modules/consistency";
import { programsAnalysis } from "@/lib/digest/modules/programs";
import { burnoutAnalysis } from "@/lib/digest/modules/burnout";
import { opportunityAnalysis } from "@/lib/digest/modules/opportunity";
import type { ScheduleData } from "@/lib/schedule/types";

function makeData(opts: { sleep?: boolean; recovery?: boolean } = {}): ScheduleData {
  const { sleep = true, recovery = true } = opts;
  const routine = [
    { id: "r1", day: 1, kind: "deep", title: "Focus", start: "10:00", end: "12:00" },
    ...(recovery ? [{ id: "r2", day: 1, kind: "rest", title: "Walk", start: "12:00", end: "12:30" }] : []),
  ];
  return {
    meta: {
      version: 3,
      owner: "Tester",
      cycle: { name: "C", number: 1, week: 1, progress: 0 },
      workdayStart: "09:00",
      workdayEnd: "18:00",
      focusCategoryIds: ["deep"],
      ...(sleep ? { sleepSchedule: [{ start: "23:00", end: "07:00" }] } : {}),
    },
    categories: [
      { id: "deep", label: "Deep Work", tone: "custom", description: "Focus", role: "focus" },
      { id: "rest", label: "Rest", tone: "custom", description: "Recovery", role: "recovery" },
    ],
    routine,
    commitments: [],
    presets: [],
    suggestions: [],
    goals: [],
    ledger: { compositionScore: 0.5, metrics: [], scheduledHours: [] },
    progressSnapshots: [],
  } as unknown as ScheduleData;
}

/* ── Range + context foundation ────────────────────────────── */

describe("rangeForTimeframe", () => {
  it("daily covers a single day", () => {
    const r = rangeForTimeframe("daily");
    expect(r.start).toBe(r.end);
  });
  it("weekly spans Sunday→Saturday", () => {
    // Parse locally — `new Date("YYYY-MM-DD")` is UTC and would shift the weekday.
    const localDay = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getDay(); };
    const r = rangeForTimeframe("weekly");
    expect(localDay(r.start)).toBe(0);
    expect(localDay(r.end)).toBe(6);
  });
  it("monthly starts on the 1st", () => {
    expect(rangeForTimeframe("monthly").start.endsWith("-01")).toBe(true);
  });
  it("custom normalises reversed ranges", () => {
    expect(rangeForTimeframe("custom", { start: "2026-06-10", end: "2026-06-01" }))
      .toEqual({ start: "2026-06-01", end: "2026-06-10" });
  });
});

describe("buildDigestContext", () => {
  it("expands a single day for the daily timeframe", () => {
    const ctx = buildDigestContext(makeData(), "daily");
    expect(ctx.dayCount).toBe(1);
    expect(ctx.days).toHaveLength(1);
  });

  it("expands seven days for the weekly timeframe and aggregates blocks", () => {
    const ctx = buildDigestContext(makeData(), "weekly");
    expect(ctx.days).toHaveLength(7);
    expect(totalMinutes(ctx)).toBeGreaterThan(0);
    expect(minutesByCategory(ctx).get("deep")).toBe(120); // 10:00–12:00 once in the week
  });
});

describe("classification helpers", () => {
  const data = makeData();
  it("resolves recovery categories by role", () => {
    expect(recoveryKindSet(data).has("rest")).toBe(true);
    expect(recoveryKindSet(data).has("deep")).toBe(false);
  });
  it("resolves focus kinds from meta.focusCategoryIds", () => {
    expect(isFocusKind("deep", data)).toBe(true);
    expect(isFocusKind("rest", data)).toBe(false);
  });
  it("resolves a category label with a fallback to the id", () => {
    expect(categoryLabel(data, "deep")).toBe("Deep Work");
    expect(categoryLabel(data, "unknown")).toBe("unknown");
  });
});

/* ── A heuristic module's actual logic ─────────────────────── */

describe("recoveryAnalysis", () => {
  it("warns when no sleep schedule is configured", () => {
    const cards = recoveryAnalysis(makeData({ sleep: false }), buildDigestContext(makeData({ sleep: false }), "weekly"));
    expect(cards.some((c) => c.title === "Sleep schedule not configured")).toBe(true);
  });

  it("warns when activity exists but no recovery is scheduled", () => {
    const data = makeData({ recovery: false });
    const cards = recoveryAnalysis(data, buildDigestContext(data, "weekly"));
    expect(cards.some((c) => c.title === "No recovery time scheduled")).toBe(true);
  });
});

/* ── All 8 heuristic modules are crash-safe ────────────────── */

describe("heuristic modules are crash-safe and return cards", () => {
  const modules = [
    recoveryAnalysis, productivityAnalysis, scheduleQualityAnalysis, goalAlignmentAnalysis,
    consistencyAnalysis, programsAnalysis, burnoutAnalysis, opportunityAnalysis,
  ];
  const data = makeData();
  const ctx = buildDigestContext(data, "weekly");

  it("every module returns a ReportCard array without throwing", () => {
    for (const mod of modules) {
      const cards = mod(data, ctx);
      expect(Array.isArray(cards)).toBe(true);
    }
  });

  it("tolerates an empty schedule", () => {
    const empty = { ...data, routine: [], commitments: [] } as ScheduleData;
    const emptyCtx = buildDigestContext(empty, "weekly");
    for (const mod of modules) {
      expect(() => mod(empty, emptyCtx)).not.toThrow();
    }
  });
});
