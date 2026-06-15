import { useState, useCallback, useEffect, useRef } from "react";
import type {
  LearningProfile,
  CompletionRecord,
  DailyPattern,
  CategoryPreference,
  ProductivityWindow,
  GoalCompletionRecord,
} from "./types";
import { EMPTY_PROFILE } from "./types";
import { timeToMinutes } from "@/lib/schedule/types";

const STORAGE_KEY = "chronos.learning.v1";

export function loadProfile(): LearningProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROFILE };
    return JSON.parse(raw) as LearningProfile;
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveProfile(profile: LearningProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* noop */
  }
}

function stdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const sqDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function normalizeVariance(rawStdDev: number, range: number): number {
  const normalized = rawStdDev / range;
  return Math.min(1, Math.max(0, normalized));
}

function recompute(profile: LearningProfile): LearningProfile {
  const completions = profile.completions;
  const patterns = profile.dailyPatterns;

  const byCategory = new Map<string, CompletionRecord[]>();
  for (const c of completions) {
    const list = byCategory.get(c.categoryId);
    if (list) {
      list.push(c);
    } else {
      byCategory.set(c.categoryId, [c]);
    }
  }

  const categoryPreferences: CategoryPreference[] = [];
  for (const [categoryId, records] of byCategory) {
    const startMinutes = records.map((r) => timeToMinutes(r.start));
    const durations = records.map((r) => r.durationMin);
    const avgStart = startMinutes.reduce((a, b) => a + b, 0) / startMinutes.length;
    const avgDur = durations.reduce((a, b) => a + b, 0) / durations.length;
    const startDev = stdDev(startMinutes, avgStart);
    const startVariance = normalizeVariance(startDev, 720);
    const completedCount = records.filter((r) => r.completed).length;
    const completionRate = records.length > 0 ? completedCount / records.length : 0;
    const dayCounts = new Array(7).fill(0);
    for (const r of records) {
      const d = new Date(r.date + "T00:00:00");
      dayCounts[d.getDay()]++;
    }
    const maxCount = Math.max(...dayCounts);
    const threshold = maxCount * 0.6;
    const preferredDays = dayCounts
      .map((count, day) => (count >= threshold && count > 0 ? day : -1))
      .filter((d) => d >= 0);

    categoryPreferences.push({
      categoryId,
      preferredStartMin: Math.round(avgStart),
      startVariance,
      averageDurationMin: Math.round(avgDur),
      completionRate,
      totalSessions: records.length,
      preferredDays,
    });
  }

  const timeBlocks: { label: string; start: number; end: number }[] = [
    { label: "morning", start: 360, end: 720 },
    { label: "afternoon", start: 720, end: 1080 },
    { label: "evening", start: 1080, end: 1440 },
  ];

  const windowMap = new Map<string, { totalFocus: number; count: number }>();
  for (const p of patterns) {
    const dayOfWeek = new Date(p.date + "T00:00:00").getDay();
    for (const tb of timeBlocks) {
      const key = `${dayOfWeek}-${tb.label}`;
      const entry = windowMap.get(key) ?? { totalFocus: 0, count: 0 };
      entry.totalFocus += p.focusMinutes;
      entry.count += 1;
      windowMap.set(key, entry);
    }
  }

  const productivityWindows: ProductivityWindow[] = [];
  for (const [key, data] of windowMap) {
    const [dayStr] = key.split("-");
    const dayOfWeek = parseInt(dayStr, 10);
    const blockLabel = key.split("-")[1];
    const tb = timeBlocks.find((t) => t.label === blockLabel);
    if (!tb) continue;
    productivityWindows.push({
      dayOfWeek,
      startMin: tb.start,
      endMin: tb.end,
      averageFocusScore: data.count > 0 ? data.totalFocus / data.count : 0,
      sessionCount: data.count,
    });
  }

  const totalFocusMin = patterns.reduce((s, p) => s + p.focusMinutes, 0);
  const totalRecoveryMin = patterns.reduce((s, p) => s + p.recoveryMinutes, 0);
  const totalCompRate = patterns.reduce((s, p) => s + p.completionRate, 0);
  const dayCount = patterns.length;
  const avgFocusPerDay = dayCount > 0 ? Math.round(totalFocusMin / dayCount) : 0;
  const avgRecoveryPerDay = dayCount > 0 ? Math.round(totalRecoveryMin / dayCount) : 0;
  const avgCompletionRate = dayCount > 0 ? totalCompRate / dayCount : 0;

  const catUsage = completions.reduce<Record<string, number>>((acc, c) => {
    acc[c.categoryId] = (acc[c.categoryId] ?? 0) + 1;
    return acc;
  }, {});
  const sortedCats = Object.entries(catUsage).sort((a, b) => b[1] - a[1]);
  const commonlyUsedCategories = sortedCats.slice(0, 3).map(([id]) => id);
  const neglectedCategories = sortedCats.slice(-3).filter(([, count]) => count <= 2).map(([id]) => id);

  const preferredWorkStart = "07:00";
  const preferredWorkEnd = "19:00";

  return {
    ...profile,
    categoryPreferences,
    productivityWindows,
    averageFocusMinutesPerDay: avgFocusPerDay,
    averageRecoveryMinutesPerDay: avgRecoveryPerDay,
    averageCompletionRate: avgCompletionRate,
    preferredWorkStart,
    preferredWorkEnd,
    commonlyUsedCategories,
    neglectedCategories,
    lastUpdated: new Date().toISOString(),
  };
}

export function useLearningProfile(): {
  profile: LearningProfile;
  recordCompletion: (record: CompletionRecord) => void;
  updateDailyPattern: (pattern: DailyPattern) => void;
  recalculatePreferences: () => void;
  recordGoalCompletion: (record: GoalCompletionRecord) => void;
  recalculateGoalPreferences: () => void;
  resetProfile: () => void;
} {
  const [profile, setProfile] = useState<LearningProfile>(() => loadProfile());
  const profileRef = useRef(profile);
  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  const recordCompletion = useCallback((record: CompletionRecord) => {
    setProfile((prev) => {
      const next = {
        ...prev,
        completions: [...prev.completions, record],
        totalDaysTracked: Math.max(
          prev.totalDaysTracked,
          new Set([...prev.completions.map((c) => c.date), record.date]).size
        ),
      };
      return recompute(next);
    });
  }, []);

  const updateDailyPattern = useCallback((pattern: DailyPattern) => {
    setProfile((prev) => {
      const filtered = prev.dailyPatterns.filter((p) => p.date !== pattern.date);
      const next = {
        ...prev,
        dailyPatterns: [...filtered, pattern],
        totalDaysTracked: Math.max(
          prev.totalDaysTracked,
          new Set([...prev.dailyPatterns.map((p) => p.date), pattern.date]).size
        ),
      };
      return recompute(next);
    });
  }, []);

  const recalculatePreferences = useCallback(() => {
    setProfile((prev) => recompute(prev));
  }, []);

  const recalculateGoalPreferences = useCallback(() => {
    setProfile((prev) => {
      const byGoal = new Map<string, GoalCompletionRecord[]>();
      for (const rec of prev.goalCompletions) {
        const list = byGoal.get(rec.goalId);
        if (list) {
          list.push(rec);
        } else {
          byGoal.set(rec.goalId, [rec]);
        }
      }

      const goalDeltas: { goalId: string; totalDelta: number }[] = [];
      for (const [goalId, records] of byGoal) {
        const totalDelta = records.reduce((s, r) => s + r.delta, 0);
        goalDeltas.push({ goalId, totalDelta });
      }

      goalDeltas.sort((a, b) => a.totalDelta - b.totalDelta);

      const quartileSize = Math.max(1, Math.floor(goalDeltas.length / 4));
      const neglectedGoalIds = goalDeltas.slice(0, quartileSize).map((g) => g.goalId);

      return {
        ...prev,
        neglectedGoalIds,
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const recordGoalCompletion = useCallback((record: GoalCompletionRecord) => {
    setProfile((prev) => {
      const next = {
        ...prev,
        goalCompletions: [...prev.goalCompletions, record],
      };
      const byGoal = new Map<string, GoalCompletionRecord[]>();
      for (const rec of next.goalCompletions) {
        const list = byGoal.get(rec.goalId);
        if (list) {
          list.push(rec);
        } else {
          byGoal.set(rec.goalId, [rec]);
        }
      }

      const goalDeltas: { goalId: string; totalDelta: number }[] = [];
      for (const [goalId, records] of byGoal) {
        const totalDelta = records.reduce((s, r) => s + r.delta, 0);
        goalDeltas.push({ goalId, totalDelta });
      }

      goalDeltas.sort((a, b) => a.totalDelta - b.totalDelta);

      const quartileSize = Math.max(1, Math.floor(goalDeltas.length / 4));
      const neglectedGoalIds = goalDeltas.slice(0, quartileSize).map((g) => g.goalId);

      return {
        ...next,
        neglectedGoalIds,
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const resetProfile = useCallback(() => {
    setProfile({ ...EMPTY_PROFILE, lastUpdated: new Date().toISOString() });
  }, []);

  return {
    profile,
    recordCompletion,
    updateDailyPattern,
    recalculatePreferences,
    recordGoalCompletion,
    recalculateGoalPreferences,
    resetProfile,
  };
}
