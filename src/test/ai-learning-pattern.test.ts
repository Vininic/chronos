import { describe, it, expect, beforeEach } from "vitest";
import { detectPatterns } from "@/lib/ai/pattern/detect";
import { loadProfile, saveProfile } from "@/lib/ai/learning/store";
import { EMPTY_PROFILE, type DailyPattern, type LearningProfile } from "@/lib/ai/learning/types";

function dp(date: string, over: Partial<DailyPattern> = {}): DailyPattern {
  return { date, focusMinutes: 0, recoveryMinutes: 0, totalMinutes: 0, categoryMinutes: {}, completionRate: 0.8, overloadScore: 0, ...over };
}
function profileWith(dailyPatterns: DailyPattern[]): LearningProfile {
  return { ...EMPTY_PROFILE, dailyPatterns };
}

/* ── pattern/detect.ts ─────────────────────────────────────── */

describe("detectPatterns", () => {
  it("returns nothing with fewer than 3 days of data", () => {
    expect(detectPatterns(profileWith([dp("2026-06-01"), dp("2026-06-02")]))).toEqual([]);
  });

  it("flags a declining completion rate", () => {
    const days = [
      dp("2026-06-01", { completionRate: 0.9 }), dp("2026-06-02", { completionRate: 0.9 }), dp("2026-06-03", { completionRate: 0.9 }),
      ...["04", "05", "06", "07", "08", "09", "10"].map((d) => dp(`2026-06-${d}`, { completionRate: 0.5 })),
    ];
    const found = detectPatterns(profileWith(days));
    expect(found.some((p) => p.type === "declining-completion")).toBe(true);
  });

  it("flags a recovery drop", () => {
    const days = [
      dp("2026-06-01", { recoveryMinutes: 120 }), dp("2026-06-02", { recoveryMinutes: 120 }), dp("2026-06-03", { recoveryMinutes: 120 }),
      ...["04", "05", "06", "07", "08", "09", "10"].map((d) => dp(`2026-06-${d}`, { recoveryMinutes: 50 })),
    ];
    expect(detectPatterns(profileWith(days)).some((p) => p.type === "recovery-drop")).toBe(true);
  });

  it("flags a sustained overload trend", () => {
    const days = ["01", "02", "03", "04", "05"].map((d) => dp(`2026-06-${d}`, { overloadScore: 0.7 }));
    expect(detectPatterns(profileWith(days)).some((p) => p.type === "overload-trend")).toBe(true);
  });

  it("flags a consistently skipped weekday", () => {
    // three dates 7 days apart → same weekday, all low completion
    const days = [
      dp("2026-06-01", { completionRate: 0.1, totalMinutes: 300 }),
      dp("2026-06-08", { completionRate: 0.1, totalMinutes: 300 }),
      dp("2026-06-15", { completionRate: 0.1, totalMinutes: 300 }),
    ];
    expect(detectPatterns(profileWith(days)).some((p) => p.type === "skipped-day")).toBe(true);
  });
});

/* ── learning/store.ts persistence ─────────────────────────── */

describe("loadProfile / saveProfile", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a saved profile", () => {
    const profile = profileWith([dp("2026-06-01", { focusMinutes: 90 })]);
    saveProfile(profile);
    const loaded = loadProfile();
    expect(loaded.dailyPatterns).toHaveLength(1);
    expect(loaded.dailyPatterns[0].focusMinutes).toBe(90);
  });

  it("returns an empty profile when nothing is stored", () => {
    expect(loadProfile().totalDaysTracked).toBe(0);
    expect(loadProfile().completions).toEqual([]);
  });

  it("falls back to an empty profile on corrupted storage", () => {
    localStorage.setItem("chronos.learning.v1", "{not valid json");
    expect(loadProfile().completions).toEqual([]);
  });
});
