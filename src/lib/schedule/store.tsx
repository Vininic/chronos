import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import seedEn from "@/data/schedule-en.json";
import seedPt from "@/data/schedule-pt.json";
import type { Category, Commitment, Goal, GoalBlock, Preset, RoutineBlock, ScheduleData, Suggestion, SleepCut, SleepScheduleEntry } from "./types";
import { durationMin, timeToMinutes, getPeriodStartEnd, computeGoalProgress, isGoalTrackingValid, isGoalPeriodValid, getDefaultGoalTracking, getDefaultGoalPeriod } from "./types";
import type { Locale } from "@/lib/i18n/dictionaries";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { isDefaultCategoryDescription, isDefaultCategoryLabel } from "@/lib/i18n/scheduleText";

const SCHEMA_VERSION = 5;
const STORAGE_KEY = "chronos.schedule.v5";
const LEGACY_STORAGE_KEYS = ["chronos.schedule.v4", "chronos.schedule.v3", "chronos.schedule.v2", "chronos.schedule.v1"];

function getSeedForLocale(locale: Locale): ScheduleData {
  return locale === "pt" ? (seedPt as ScheduleData) : (seedEn as ScheduleData);
}

function load(locale: Locale = "en"): ScheduleData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      ?? LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
      ?? null;
    if (raw) return normalizeNamingModel(JSON.parse(raw) as ScheduleData, locale);
  } catch {}
  return normalizeNamingModel(getSeedForLocale(locale), locale);
}


function normalizeNamingModel(data: ScheduleData, locale: Locale): ScheduleData {
  const categories = data.categories.map((c) => {
    const labelCustom = c.labelCustom ?? (!isDefaultCategoryLabel(c.id, c.label) ? c.label : undefined);
    const descriptionCustom = c.descriptionCustom ?? (!isDefaultCategoryDescription(c.description) ? c.description : undefined);
    return { ...c, labelCustom, descriptionCustom };
  });

  const routine = data.routine
    // Strip legacy boundary sleep blocks — sleep is now a schedule concept, not routine blocks
    .filter((r) => r.kind !== "sleep" || r.id.startsWith("r-custom-sleep"))
    .map((r) => ({
      ...r,
      endsNextDay: r.endsNextDay ?? r.end <= r.start,
    }));

  const sleepSchedule = migrateSleepSchedule(data);

  // v5→v6: "count" merged into "numeric"; enforce kind×tracking×period matrix
  const goals: Goal[] = (data.goals ?? []).map((g) => {
    const kind = ((g.kind as string) === "count" ? "numeric" : g.kind) as Goal["kind"];
    const tracking = isGoalTrackingValid(kind, g.tracking as Goal["tracking"])
      ? (g.tracking as Goal["tracking"])
      : getDefaultGoalTracking(kind);
    const period = isGoalPeriodValid(kind, tracking, g.period as Goal["period"])
      ? (g.period as Goal["period"])
      : getDefaultGoalPeriod(kind, tracking);
    return { ...g, kind, tracking, period };
  });

  return {
    ...data,
    categories,
    routine,
    presets: data.presets ?? [],
    goals,
    suggestions: data.suggestions ?? [],
    progressSnapshots: data.progressSnapshots ?? [],
    meta: {
      ...data.meta,
      version: SCHEMA_VERSION,
      enforceSleepBoundary: data.meta.enforceSleepBoundary ?? true,
      focusCategoryIds: data.meta.focusCategoryIds ?? (data.meta.focusCategoryId ? [data.meta.focusCategoryId] as string[] : undefined),
      sleepSchedule,
      sleepWindow: normalizeSleepWindow(data), // keep for legacy compat
    },
  };
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && bs < ae;
}

function dayFromIsoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).getDay();
}

function dateToIso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function minutesToTime(min: number) {
  if (min >= 24 * 60) return "24:00";
  const clamped = Math.max(0, Math.min(23 * 60 + 59, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDaysToIso(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

function toDateTime(isoDate: string, time: string) {
  return new Date(`${isoDate}T${time}:00`);
}

function sanitizeSleepWindow(
  sleepWindow: { start: string; end: string },
  fallbackMorningEnd: string,
) {
  const s = timeToMinutes(sleepWindow.start);
  const e = timeToMinutes(sleepWindow.end);

  // Legacy UI bug could save cross-day sleep endings as 23:59.
  // If sleep starts at night and ends at the very end of the same day,
  // restore a cross-day morning end anchored to workday start.
  if (s >= 18 * 60 && e >= s && e >= 23 * 60 + 45) {
    return { start: sleepWindow.start, end: fallbackMorningEnd };
  }

  return sleepWindow;
}

/** Derive a single legacy sleepWindow from routine sleep blocks (for old data migration). */
function legacySleepWindowFromRoutine(data: ScheduleData): { start: string; end: string } {
  const sleep = data.routine.filter((r) => r.kind === "sleep");
  const morningEnd = sleep
    .filter((r) => timeToMinutes(r.end) <= 12 * 60)
    .reduce((m, r) => Math.max(m, timeToMinutes(r.end)), timeToMinutes(data.meta.workdayStart));
  const eveningStart = sleep
    .filter((r) => timeToMinutes(r.start) >= 18 * 60)
    .reduce((m, r) => Math.min(m, timeToMinutes(r.start)), timeToMinutes(data.meta.workdayEnd));
  return { start: minutesToTime(eveningStart), end: minutesToTime(morningEnd) };
}

/** Migrate legacy sleepWindow or routine sleep blocks to SleepScheduleEntry[]. */
function migrateSleepSchedule(data: ScheduleData): SleepScheduleEntry[] {
  if (data.meta.sleepSchedule && data.meta.sleepSchedule.length > 0) {
    return data.meta.sleepSchedule;
  }
  // Migrate from sleepWindow
  const win = data.meta.sleepWindow ?? legacySleepWindowFromRoutine(data);
  return [{ start: win.start, end: win.end }]; // all days
}

/** Get the sleep window for a specific day-of-week (0=Sun..6=Sat).
 *  Returns the first matching SleepScheduleEntry, or null if none.
 *  Per-day entries always take precedence over all-days entries. */
export function getSleepWindowForDay(schedule: SleepScheduleEntry[], dayOfWeek: number): SleepScheduleEntry | null {
  const perDay = schedule.find((e) => e.days?.includes(dayOfWeek));
  if (perDay) return perDay;
  return schedule.find((e) => !e.days) ?? null;
}

/** Normalize sleepWindow (legacy compat). */
function normalizeSleepWindow(data: ScheduleData): { start: string; end: string } {
  if (data.meta.sleepWindow) return sanitizeSleepWindow(data.meta.sleepWindow, data.meta.workdayStart);
  return legacySleepWindowFromRoutine(data);
}

function resolveCommitmentEndDate(c: Pick<Commitment, "date" | "start" | "end" | "endDate" | "endsNextDay">) {
  if (!c.date) return c.date;
  if (c.endDate) return c.endDate;
  if (c.endsNextDay || c.end <= c.start) return addDaysToIso(c.date, 1);
  return c.date;
}

function commitmentInterval(c: Pick<Commitment, "date" | "start" | "end" | "endDate" | "endsNextDay">) {
  if (!c.date) return { start: new Date(NaN), end: new Date(NaN) };
  const start = toDateTime(c.date, c.start);
  const end = toDateTime(resolveCommitmentEndDate(c)!, c.end);
  return { start, end };
}

function buildRoutineWeeklySegments(r: Pick<RoutineBlock, "day" | "start" | "end" | "endsNextDay">) {
  const startMin = timeToMinutes(r.start);
  const endMin = timeToMinutes(r.end);
  const spans = r.endsNextDay ?? endMin <= startMin;

  if (!spans) {
    return [{ day: r.day, startMin, endMin }];
  }

  return [
    { day: r.day, startMin, endMin: 24 * 60 },
    { day: (r.day + 1) % 7, startMin: 0, endMin },
  ];
}

function sleepBlockedIntervalsForDay(
  schedule: SleepScheduleEntry[],
  day: number,
  sleepCuts?: SleepCut[],
  dateIso?: string,
) {
  const entry = getSleepWindowForDay(schedule, day);
  if (!entry || entry.start === entry.end) {
    return dateIso && sleepCuts
      ? sleepCuts
        .filter((c) => c.date === dateIso)
        .map((c) => ({ start: timeToMinutes(c.start), end: timeToMinutes(c.end) }))
        .filter((i) => i.end > i.start)
      : [];
  }
  const start = timeToMinutes(entry.start);
  const end = timeToMinutes(entry.end);
  const intervals: Array<{ start: number; end: number }> = [];

  if (start > end) {
    intervals.push({ start: 0, end });
    intervals.push({ start, end: 24 * 60 });
  } else if (start < end) {
    intervals.push({ start, end });
  }

  if (dateIso && sleepCuts) {
    intervals.push(
      ...sleepCuts
        .filter((c) => c.date === dateIso)
        .map((c) => ({ start: timeToMinutes(c.start), end: timeToMinutes(c.end) }))
        .filter((i) => i.end > i.start),
    );
  }

  return intervals;
}

function overlapsBlockedIntervals(startMin: number, endMin: number, blocked: Array<{ start: number; end: number }>) {
  return blocked.some((i) => startMin < i.end && endMin > i.start);
}

function validateRoutineSleepOverlap(data: ScheduleData, candidate: Pick<RoutineBlock, "day" | "start" | "end" | "endsNextDay">) {
  if (data.meta.enforceSleepBoundary === false) return null;
  const schedule = data.meta.sleepSchedule ?? migrateSleepSchedule(data);
  const segments = buildRoutineWeeklySegments(candidate);
  for (const segment of segments) {
    const blocked = sleepBlockedIntervalsForDay(schedule, segment.day);
    if (overlapsBlockedIntervals(segment.startMin, segment.endMin, blocked)) {
      return "Conflicts with sleep hours.";
    }
  }
  return null;
}

function commitmentDaySlices(c: Pick<Commitment, "date" | "start" | "end" | "endDate" | "endsNextDay">) {
  if (!c.date) return [];
  const startDate = c.date;
  const resolvedEndDate = resolveCommitmentEndDate(c);
  if (!resolvedEndDate) return [];
  const spans = resolvedEndDate > startDate || c.end <= c.start || c.endsNextDay;
  if (!spans) {
    return [{ dateIso: startDate, day: dayFromIsoDate(startDate), startMin: timeToMinutes(c.start), endMin: timeToMinutes(c.end) }];
  }
  return [
    { dateIso: startDate, day: dayFromIsoDate(startDate), startMin: timeToMinutes(c.start), endMin: 24 * 60 },
    { dateIso: resolvedEndDate, day: dayFromIsoDate(resolvedEndDate), startMin: 0, endMin: timeToMinutes(c.end) },
  ];
}

function validateCommitmentSleepOverlap(data: ScheduleData, candidate: Pick<Commitment, "date" | "start" | "end" | "endDate" | "endsNextDay">) {
  if (data.meta.enforceSleepBoundary === false) return null;
  const schedule = data.meta.sleepSchedule ?? migrateSleepSchedule(data);
  for (const slice of commitmentDaySlices(candidate)) {
    const blocked = sleepBlockedIntervalsForDay(schedule, slice.day, data.meta.sleepCuts, slice.dateIso);
    if (overlapsBlockedIntervals(slice.startMin, slice.endMin, blocked)) {
      return "Conflicts with sleep hours.";
    }
  }
  return null;
}

function intersectsClockRange(
  rangeStart: string,
  rangeEnd: string,
  blockStart: string,
  blockEnd: string,
) {
  return overlap(rangeStart, rangeEnd, blockStart, blockEnd);
}

function subtractRanges(
  base: { start: string; end: string },
  blockers: { start: string; end: string }[],
) {
  let segments = [base];

  for (const blocker of blockers) {
    const nextSegments: { start: string; end: string }[] = [];
    for (const segment of segments) {
      if (!intersectsClockRange(segment.start, segment.end, blocker.start, blocker.end)) {
        nextSegments.push(segment);
        continue;
      }

      if (timeToMinutes(blocker.start) > timeToMinutes(segment.start)) {
        nextSegments.push({ start: segment.start, end: blocker.start });
      }
      if (timeToMinutes(blocker.end) < timeToMinutes(segment.end)) {
        nextSegments.push({ start: blocker.end, end: segment.end });
      }
    }
    segments = nextSegments.filter((segment) => timeToMinutes(segment.end) - timeToMinutes(segment.start) >= 15);
  }

  return segments;
}

function intervalsOverlap(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && b.start < a.end;
}

function buildSleepSegmentsForDate(
  sleepWindow: { start: string; end: string },
  date: Date,
  sleepTitle: string,
) {
  const iso = dateToIso(date);
  const s = timeToMinutes(sleepWindow.start);
  const e = timeToMinutes(sleepWindow.end);

  if (s > e) {
    return [
      {
        id: `sleep-am-${iso}`,
        title: sleepTitle,
        titleCustom: undefined,
        notes: undefined,
        start: "00:00",
        end: sleepWindow.end,
        continuesFromPrevDay: true,
        continuesToNextDay: false,
        kind: "sleep" as const,
        source: "routine" as const,
        sleepBoundary: true,
      },
      {
        id: `sleep-pm-${iso}`,
        title: sleepTitle,
        titleCustom: undefined,
        notes: undefined,
        start: sleepWindow.start,
        end: "24:00",
        continuesFromPrevDay: false,
        continuesToNextDay: true,
        kind: "sleep" as const,
        source: "routine" as const,
        sleepBoundary: true,
      },
    ];
  }
  if (s < e) {
    return [
      {
        id: `sleep-mid-${iso}`,
        title: sleepTitle,
        titleCustom: undefined,
        notes: undefined,
        start: sleepWindow.start,
        end: sleepWindow.end,
        continuesFromPrevDay: false,
        continuesToNextDay: false,
        kind: "sleep" as const,
        source: "routine" as const,
        sleepBoundary: true,
      },
    ];
  }
  return [];
}

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function getConflictMessage(type: "blockRoutine" | "blockCommitment" | "routineCommitment", title: string, start: string, end: string, locale: Locale): string {
  const conflicts = DICTIONARIES[locale].chronos.store.conflicts;
  return conflicts[type](title, start, end);
}

function getDayLabel(day: number, locale: Locale): string {
  return DICTIONARIES[locale].common.days.long[day];
}

function buildLedger(data: ScheduleData): ScheduleData["ledger"] {
  const catSet = new Set(data.routine.map((r) => r.kind));
  const catCount = catSet.size;

  const totalRoutineMin = data.routine.reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);

  const maxCatMin = Math.max(1, ...data.categories.map((c) =>
    data.routine.filter((r) => r.kind === c.id)
      .reduce((s, r) => s + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0)
  ));
  const topCatRatio = maxCatMin / Math.max(1, totalRoutineMin);

  const weekdays = [1, 2, 3, 4, 5];
  const dayMins = weekdays.map((d) =>
    data.routine.filter((r) => r.day === d)
      .reduce((s, r) => s + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0)
  );
  const avgDayMin = dayMins.reduce((s, v) => s + v, 0) / Math.max(1, dayMins.length);
  const variance = dayMins.reduce((s, v) => s + (v - avgDayMin) ** 2, 0) / Math.max(1, dayMins.length);
  const consistencyScore = clamp(Math.round((1 - Math.min(1, Math.sqrt(variance) / Math.max(1, avgDayMin))) * 100));
  const loadScore = clamp(Math.round((totalRoutineMin / (40 * 60)) * 100));
  const varietyScore = clamp(Math.round((catCount / Math.max(1, data.categories.length)) * 100));

  const compositionScore = clamp(
    Math.round(loadScore * 0.45 + consistencyScore * 0.3 + varietyScore * 0.25),
  );

  const focusCatIds = data.meta.focusCategoryIds ?? [];
  const focusMin = data.categories
    .filter((c) => focusCatIds.includes(c.id))
    .flatMap((c) => data.routine.filter((r) => r.kind === c.id))
    .reduce((s, r) => s + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);
  const recoveryMin = data.routine
    .filter((r) => r.kind === "recovery")
    .reduce((s, r) => s + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);

  const focusScore = clamp(Math.round(totalRoutineMin > 0 ? (focusMin / totalRoutineMin) * 100 : 0));
  const recoveryScore = clamp(Math.round(totalRoutineMin > 0 ? (recoveryMin / totalRoutineMin) * 100 : 0));

  const goalProgress = Math.round(recomputeOverallGoalProgress(data) * 100);

  const metrics = [
    { label: "Load", value: loadScore },
    { label: "Consistency", value: consistencyScore },
    { label: "Variety", value: varietyScore },
    { label: "Focus", value: focusScore },
    { label: "Recovery", value: recoveryScore },
    { label: "Goals", value: goalProgress },
  ];

  const scheduledHours = Array.from({ length: 14 }, (_, i) => {
    const d = i % 7;
    const total = data.routine
      .filter((r) => r.day === d)
      .reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);
    return Number((total / 60).toFixed(1));
  });

  return { compositionScore, metrics, scheduledHours };
}

function recomputeOverallGoalProgress(data: ScheduleData): number {
  const goals = data.goals;
  if (goals.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  let totalWeight = 0;
  let weightedSum = 0;
  for (const g of goals) {
    const p = computeGoalProgress(g, today, data.goals, data.routine, data.commitments);
    if (p.denominator > 0) {
      totalWeight += g.weight;
      weightedSum += g.weight * p.ratio;
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function sortedDayBlocks(routine: RoutineBlock[], day: number) {
  return routine
    .filter((r) => r.day === day)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start));
}

function findGap(routine: RoutineBlock[], day: number, startBound: string, endBound: string, minDuration = 60) {
  const blocks = sortedDayBlocks(routine, day);
  let cursor = timeToMinutes(startBound);
  const endLimit = timeToMinutes(endBound);

  for (const b of blocks) {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    if (bs - cursor >= minDuration) {
      return { start: minutesToTime(cursor), end: minutesToTime(Math.min(bs, cursor + Math.max(minDuration, 90))) };
    }
    cursor = Math.max(cursor, be);
  }

  if (endLimit - cursor >= minDuration) {
    return { start: minutesToTime(cursor), end: minutesToTime(Math.min(endLimit, cursor + Math.max(minDuration, 90))) };
  }

  return null;
}

function generateLocalSuggestions(data: ScheduleData, locale: Locale = "en"): Suggestion[] {
  const sugg = DICTIONARIES[locale].chronos.store.suggestions;
  const suggestions: Suggestion[] = [];
  const weekdays = [1, 2, 3, 4, 5];

  for (const day of weekdays) {
    const dayBlocks = sortedDayBlocks(data.routine, day);
    const hasDeep = dayBlocks.some((b) => b.kind === "deep");
    if (!hasDeep) {
      const slot = findGap(data.routine, day, data.meta.workdayStart, data.meta.workdayEnd, 60);
      if (slot) {
        suggestions.push({
          id: `s-gap-${day}`,
          title: sugg.gapTitle(getDayLabel(day, locale)),
          detail: sugg.gapDetail,
          impact: sugg.gapImpact,
          priority: "high",
          patch: {
            type: "add-routine",
            block: {
              day,
              start: slot.start,
              end: slot.end,
              kind: "deep",
              title: "Deep session",
            },
          },
        });
      }
    }
  }

  for (const day of weekdays) {
    const dayBlocks = sortedDayBlocks(data.routine, day);
    const meetingMin = dayBlocks
      .filter((b) => b.kind === "meeting")
      .reduce((sum, b) => sum + Math.max(0, timeToMinutes(b.end) - timeToMinutes(b.start)), 0);
    const deepMin = dayBlocks
      .filter((b) => b.kind === "deep")
      .reduce((sum, b) => sum + Math.max(0, timeToMinutes(b.end) - timeToMinutes(b.start)), 0);
    if (meetingMin >= 120 && deepMin < 90) {
      const slot = findGap(data.routine, day, "13:00", data.meta.workdayEnd, 45);
      if (slot) {
        suggestions.push({
          id: `s-balance-${day}`,
          title: sugg.rebalanceTitle(getDayLabel(day, locale)),
          detail: sugg.rebalanceDetail,
          impact: sugg.rebalanceImpact,
          priority: "med",
          patch: {
            type: "add-routine",
            block: {
              day,
              start: slot.start,
              end: slot.end,
              kind: "deep",
              title: sugg.rebalanceBlockTitle,
            },
          },
        });
      }
    }
  }

  const lightDays = weekdays.filter((day) => sortedDayBlocks(data.routine, day).length < 2);
  if (lightDays.length > 0) {
    const day = lightDays[0];
    const slot = findGap(data.routine, day, "07:00", "10:30", 30);
    if (slot) {
      suggestions.push({
        id: `s-partial-${day}`,
        title: sugg.partialTitle,
        detail: sugg.partialDetail,
        impact: sugg.partialImpact,
        priority: "med",
        patch: {
          type: "add-routine",
          block: {
            day,
            start: slot.start,
            end: slot.end,
            kind: "ritual",
            title: sugg.partialBlockTitle,
          },
        },
      });
    }
  }

  const deepWeekdays = new Set(
    data.routine.filter((r) => r.kind === "deep" && r.day >= 1 && r.day <= 5).map((r) => r.day),
  ).size;
  if (deepWeekdays < 4) {
    const candidates = [2, 4]
      .map((day) => {
        const slot = findGap(data.routine, day, "08:00", "12:30", 75);
        if (!slot) return null;
        return {
          day,
          start: slot.start,
          end: slot.end,
          kind: "deep" as const,
          title: sugg.structureBlockTitle,
        };
      })
      .filter(Boolean) as Omit<RoutineBlock, "id">[];

    if (candidates.length > 0) {
      suggestions.push({
        id: "s-week-structure",
        title: sugg.structureTitle,
        detail: sugg.structureDetail,
        impact: sugg.structureImpact,
        priority: "high",
        patch: { type: "add-routines", blocks: candidates },
      });
    }
  }

  return suggestions.slice(0, 8);
}

function withDerived(data: ScheduleData, regenerateSuggestions = false, locale: Locale = "en"): ScheduleData {
  return {
    ...data,
    meta: {
      ...data.meta,
      version: SCHEMA_VERSION,
    },
    ledger: buildLedger(data),
    suggestions: regenerateSuggestions ? generateLocalSuggestions(data, locale) : data.suggestions,
  };
}

interface Ctx {
  data: ScheduleData;
  addRoutine: (b: Omit<RoutineBlock, "id">) => string | null;
  updateRoutine: (id: string, patch: Partial<RoutineBlock>) => string | null;
  removeRoutine: (id: string) => void;
  addCommitment: (c: Omit<Commitment, "id">) => string | null;
  removeCommitment: (id: string) => void;
  updateCommitment: (id: string, patch: Partial<Commitment>) => string | null;
  addPreset: (p: Omit<Preset, "id">) => string;
  removePreset: (id: string) => void;
  updatePreset: (id: string, patch: Partial<Preset>) => void;
  pushMoveDayChain: (date: Date, source: "routine" | "commitment", id: string, newStart: string, newEnd: string, dragDeltaMin?: number, dragEdge?: "top" | "bottom") => string | null;
  setSleepBoundaryEnforced: (enforced: boolean) => void;
  setFocusCategories: (ids: string[]) => void;
  updateSleepWindow: (patch: Partial<{ start: string; end: string }>) => void;
  updateSleepSchedule: (schedule: SleepScheduleEntry[]) => void;
  addSleepCut: (cut: Omit<SleepCut, never>) => void;
  removeSleepCut: (target: { date: string; start?: string; end?: string }) => void;
  updateCategory: (id: Category["id"], patch: Partial<Pick<Category, "label" | "labelCustom" | "description" | "descriptionCustom" | "tone" | "color">>) => void;
  resetCategoryNaming: (id: Category["id"]) => void;
  addCategory: (category: Omit<Category, never>) => void;
  removeCategory: (id: Category["id"]) => void;
  applySuggestion: (id: string) => void;
  deferSuggestion: (id: string) => void;
  refreshSuggestions: () => void;
  resetToSeed: () => void;
  replace: (next: ScheduleData) => void;
  addGoal: (g: Omit<Goal, "id" | "blocks" | "subTasks" | "looseCommitmentIds" | "createdAt">) => string;
  recordProgressSnapshots: () => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addGoalBlock: (goalId: string, b: Omit<GoalBlock, "id">) => string;
  updateGoalBlock: (goalId: string, blockId: string, patch: Partial<GoalBlock>) => void;
  removeGoalBlock: (goalId: string, blockId: string) => void;
  toggleGoalBlock: (goalId: string, blockId: string) => void;
  addGoalSubTask: (goalId: string, title: string) => void;
  toggleGoalSubTask: (goalId: string, subTaskId: string) => void;
  linkLooseCommitment: (goalId: string, commitmentId: string) => void;
  generateGoalCommitments: (goalId: string) => void;
  trackBlockForGoal: (goalId: string, blockKey: string) => void;
  isBlockTrackedForAnyGoal: (blockKey: string) => boolean;
  getGoalsForDate: (date: string) => Goal[];
  overallGoalProgress: () => number;
}

const ScheduleCtx = createContext<Ctx | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [data, setData] = useState<ScheduleData>(() => {
    const initial = load(locale);
    return withDerived(initial, true, locale);
  });

  // Wrapper to automatically include locale when calling withDerived
  const withDerivedLocale = useCallback((d: ScheduleData, regen = false) => withDerived(d, regen, locale), [locale]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  // When locale changes, if user hasn't customized their schedule, reinitialize with new seed
  useEffect(() => {
    const userHasCustomized = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return false;
        const original = JSON.parse(stored) as ScheduleData;
        const current = data;
        // Simple check: if routine/categories/meta have been modified beyond the initial seed
        // For now, we'll just check if localStorage exists (user has made any changes)
        return true; // Assume they have customized if they have stored data
      } catch {
        return false;
      }
    };

    // Don't auto-reload seed if user has customized their data
    if (!userHasCustomized()) {
      const newSeed = load(locale);
      setData(withDerivedLocale(newSeed, true));
    }
  }, [locale, data, withDerivedLocale]);

  const addRoutine = useCallback((b: Omit<RoutineBlock, "id">) => {
    const candidate = { ...b, endsNextDay: b.endsNextDay ?? b.end <= b.start };
    const sleepErr = validateRoutineSleepOverlap(data, candidate);
    if (sleepErr) return sleepErr;
    const candidateSegments = buildRoutineWeeklySegments(candidate);
    const conflict = data.routine.find((r) => {
      const existingSegments = buildRoutineWeeklySegments(r);
      return candidateSegments.some((candidateSegment) =>
        existingSegments.some((existingSegment) =>
          candidateSegment.day === existingSegment.day
          && candidateSegment.startMin < existingSegment.endMin
          && existingSegment.startMin < candidateSegment.endMin,
        ),
      );
    });
    if (conflict) {
      return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
    }
    setData((d) => withDerived({ ...d, routine: [...d.routine, { ...candidate, id: uid("r") }] }));
    return null;
  }, [data]);
  const updateRoutine = useCallback((id: string, patch: Partial<RoutineBlock>) => {
    const current = data.routine.find((r) => r.id === id);
    if (!current) return null;
    const next = {
      ...current,
      ...patch,
      endsNextDay: patch.endsNextDay ?? current.endsNextDay ?? ((patch.end ?? current.end) <= (patch.start ?? current.start)),
    };
    const sleepErr = validateRoutineSleepOverlap(data, next);
    if (sleepErr) return sleepErr;
    const nextSegments = buildRoutineWeeklySegments(next);
    const conflict = data.routine.find((r) => {
      if (r.id === id) return false;
      const existingSegments = buildRoutineWeeklySegments(r);
      return nextSegments.some((candidateSegment) =>
        existingSegments.some((existingSegment) =>
          candidateSegment.day === existingSegment.day
          && candidateSegment.startMin < existingSegment.endMin
          && existingSegment.startMin < candidateSegment.endMin,
        ),
      );
    });
    if (conflict) {
      return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
    }
    setData((d) => withDerived({
      ...d,
      routine: d.routine.map((r) => (r.id === id ? { ...r, ...patch, endsNextDay: next.endsNextDay } : r)),
    }));
    return null;
  }, [data]);
  const removeRoutine = useCallback((id: string) => {
    setData((d) => withDerived({ ...d, routine: d.routine.filter((r) => r.id !== id) }));
  }, []);
  const addCommitment = useCallback((c: Omit<Commitment, "id">) => {
    const next: Omit<Commitment, "id"> = {
      ...c,
      endsNextDay: c.endsNextDay ?? c.end <= c.start,
    };
    if (c.date) {
      const sleepErr = validateCommitmentSleepOverlap(data, next);
      if (sleepErr) return sleepErr;
      const nextInterval = commitmentInterval(next);

      const conflictCommitment = data.commitments.find((x) => intervalsOverlap(commitmentInterval(x), nextInterval));
      if (conflictCommitment) {
        return `Conflicts with "${conflictCommitment.title}" (${conflictCommitment.start}-${conflictCommitment.end}).`;
      }
    }

    setData((d) => withDerived({ ...d, commitments: [...d.commitments, { ...next, id: uid("c") }] }));
    return null;
  }, [data]);
  const removeCommitment = useCallback((id: string) => {
    setData((d) => withDerived({ ...d, commitments: d.commitments.filter((c) => c.id !== id) }));
  }, []);
  const updateCommitment = useCallback((id: string, patch: Partial<Commitment>) => {
    const current = data.commitments.find((c) => c.id === id);
    if (!current) return null;
    const next: Commitment = {
      ...current,
      ...patch,
      endsNextDay: patch.endsNextDay ?? current.endsNextDay ?? ((patch.end ?? current.end) <= (patch.start ?? current.start)),
    };
    if (next.date) {
      const sleepErr = validateCommitmentSleepOverlap(data, next);
      if (sleepErr) return sleepErr;
      const nextInterval = commitmentInterval(next);
      const conflictCommitment = data.commitments.find((c) => c.id !== id && intervalsOverlap(commitmentInterval(c), nextInterval));
      if (conflictCommitment) {
        return `Conflicts with "${conflictCommitment.title}" (${conflictCommitment.start}-${conflictCommitment.end}).`;
      }
    }

    setData((d) => withDerived({ ...d, commitments: d.commitments.map((c) => (c.id === id ? next : c)) }));
    return null;
  }, [data]);

  /** ── Goal CRUD ── */
  const addGoal = useCallback((g: Omit<Goal, "id" | "blocks" | "subTasks" | "looseCommitmentIds" | "createdAt">) => {
    const id = uid("goal");
    const tracking = isGoalTrackingValid(g.kind, g.tracking) ? g.tracking : getDefaultGoalTracking(g.kind);
    const period = isGoalPeriodValid(g.kind, tracking, g.period) ? g.period : getDefaultGoalPeriod(g.kind, tracking);
    setData((d) => withDerived({
      ...d,
      goals: [...d.goals, { ...g, tracking, period, id, blocks: [], subTasks: [], looseCommitmentIds: [], createdAt: new Date().toISOString() }],
    }));
    return id;
  }, []);

  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => {
    setData((d) => withDerived({
      ...d,
      goals: d.goals.map((g) => {
        if (g.id !== id) return g;
        const merged = { ...g, ...patch };
        const kind = merged.kind;
        const tracking = isGoalTrackingValid(kind, merged.tracking) ? merged.tracking : getDefaultGoalTracking(kind);
        const period = isGoalPeriodValid(kind, tracking, merged.period) ? merged.period : getDefaultGoalPeriod(kind, tracking);
        return { ...merged, tracking, period };
      }),
    }));
  }, []);

  const removeGoal = useCallback((id: string) => {
    setData((d) => withDerived({
      ...d,
      goals: d.goals.filter((g) => g.id !== id),
    }));
  }, []);

  const addGoalBlock = useCallback((goalId: string, b: Omit<GoalBlock, "id">) => {
    const id = uid("gb");
    setData((d) => withDerived({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId ? { ...g, blocks: [...g.blocks, { ...b, id }] } : g
      ),
    }));
    return id;
  }, []);

  const updateGoalBlock = useCallback((goalId: string, blockId: string, patch: Partial<GoalBlock>) => {
    setData((d) => withDerived({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId
          ? { ...g, blocks: g.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }
          : g
      ),
    }));
  }, []);

  const removeGoalBlock = useCallback((goalId: string, blockId: string) => {
    setData((d) => withDerived({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId ? { ...g, blocks: g.blocks.filter((b) => b.id !== blockId) } : g
      ),
    }));
  }, []);

  const toggleGoalBlock = useCallback((goalId: string, blockId: string) => {
    setData((d) => withDerived({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId
          ? { ...g, blocks: g.blocks.map((b) => (b.id === blockId ? { ...b, done: !b.done } : b)) }
          : g
      ),
    }));
  }, []);

  const addGoalSubTask = useCallback((goalId: string, title: string) => {
    const id = uid("gst");
    setData((d) => withDerived({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId ? { ...g, subTasks: [...g.subTasks, { id, title, done: false }] } : g
      ),
    }));
  }, []);

  const toggleGoalSubTask = useCallback((goalId: string, subTaskId: string) => {
    setData((d) => withDerived({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId
          ? { ...g, subTasks: g.subTasks.map((st) => (st.id === subTaskId ? { ...st, done: !st.done } : st)) }
          : g
      ),
    }));
  }, []);

  const linkLooseCommitment = useCallback((goalId: string, commitmentId: string) => {
    setData((d) => withDerived({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId
          ? { ...g, looseCommitmentIds: [...new Set([...g.looseCommitmentIds, commitmentId])] }
          : g
      ),
    }));
  }, []);

  const generateGoalCommitments = useCallback((goalId: string) => {
    setData((d) => {
      const goal = d.goals.find((g) => g.id === goalId);
      if (!goal || goal.autoTrackMode !== "commitments") return d;
      const N = goal.target;
      const newIds: string[] = [];
      for (let i = 0; i < N; i++) {
        newIds.push(uid("cmt"));
      }
      const now = new Date().toISOString().slice(0, 10);
      return withDerived({
        ...d,
        commitments: [
          ...d.commitments,
          ...newIds.map((id, i) => ({
            id,
            date: undefined as string | undefined,
            start: "00:00",
            end: "01:00",
            kind: goal.categoryId ?? "custom",
            title: `${goal.title} ${i + 1}/${N}`,
          })),
        ],
        goals: d.goals.map((g) =>
          g.id === goalId
            ? { ...g, looseCommitmentIds: [...g.looseCommitmentIds, ...newIds] }
            : g
        ),
      });
    });
  }, []);

  const trackBlockForGoal = useCallback((goalId: string, blockKey: string) => {
    setData((d) =>
      withDerived({
        ...d,
        goals: d.goals.map((g) =>
          g.id === goalId
            ? {
                ...g,
                trackedBlockKeys: g.trackedBlockKeys?.includes(blockKey)
                  ? g.trackedBlockKeys.filter((k) => k !== blockKey)
                  : [...(g.trackedBlockKeys ?? []), blockKey],
              }
            : g
        ),
      })
    );
  }, []);

  const isBlockTrackedForAnyGoal = useCallback((blockKey: string): boolean => {
    return data.goals.some((g) => g.trackedBlockKeys?.includes(blockKey));
  }, [data]);

  const overallGoalProgress = useCallback(() => {
    return recomputeOverallGoalProgress(data);
  }, [data]);

  const recordProgressSnapshots = useCallback(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    setData((d) => {
      const snapshots = d.goals.map((g) => {
        const p = computeGoalProgress(g, todayIso, d.goals, d.routine, d.commitments);
        return { date: todayIso, goalId: g.id, numerator: p.numerator, denominator: p.denominator };
      });
      const existing = d.progressSnapshots.filter((s) => s.date !== todayIso);
      return withDerived({ ...d, progressSnapshots: [...existing, ...snapshots] });
    });
  }, []);

  const getGoalsForDate = useCallback((date: string) => {
    return data.goals.filter((g) => {
      if (g.startDate > date) return false;
      if (g.deadline && g.deadline < date) return false;
      const period = getPeriodStartEnd(g.startDate, g.period, date);
      if (!(date >= period.start && date <= period.end)) return false;
      if (g.tracking !== "category") return true;
      const mode = g.autoTrackMode ?? "always";
      if (mode === "always") return true;
      if (mode === "selected" && g.trackedBlockKeys?.length) return true;
      if (mode === "commitments" && g.looseCommitmentIds.length) {
        if (data.commitments.some((c) => g.looseCommitmentIds.includes(c.id) && c.date === date)) return true;
      }
      return false;
    });
  }, [data]);

  const addPreset = useCallback((p: Omit<Preset, "id">) => {
    const id = uid("p");
    setData((d) => withDerived({ ...d, presets: [...d.presets, { ...p, id }] }));
    return id;
  }, []);
  const removePreset = useCallback((id: string) => {
    setData((d) => withDerived({ ...d, presets: d.presets.filter((p) => p.id !== id) }));
  }, []);
  const updatePreset = useCallback((id: string, patch: Partial<Preset>) => {
    setData((d) => withDerived({ ...d, presets: d.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }, []);

  const pushMoveDayChain = useCallback((date: Date, source: "routine" | "commitment", id: string, newStart: string, newEnd: string, dragDeltaMin?: number, dragEdge?: "top" | "bottom") => {
    const day = date.getDay();
    const dayIso = dateToIso(date);
    const dayAgenda = buildAgendaForDate(data, date).filter((a) => !(a.kind === "sleep" && (a as { sleepBoundary?: boolean }).sleepBoundary));
    const moved = dayAgenda.find((a) => a.id === id && a.source === source);
    if (!moved) return "Block not found.";

    const sourceRoutine = source === "routine" ? data.routine.find((r) => r.id === id) : null;
    const sourceCommitment = source === "commitment" ? data.commitments.find((c) => c.id === id) : null;
    const sourceDuration = sourceRoutine
      ? durationMin(sourceRoutine.start, sourceRoutine.end)
      : sourceCommitment
        ? Math.max(15, Math.round((commitmentInterval(sourceCommitment).end.getTime() - commitmentInterval(sourceCommitment).start.getTime()) / 60_000) || durationMin(sourceCommitment.start, sourceCommitment.end))
        : durationMin(newStart, newEnd);
    const sourceStartMin = sourceRoutine
      ? timeToMinutes(sourceRoutine.start)
      : sourceCommitment
        ? timeToMinutes(sourceCommitment.start)
        : timeToMinutes(moved.start);

    const movedStart = timeToMinutes(newStart);
    const movedEnd = timeToMinutes(newEnd);
    const movedDur = Math.max(15, sourceDuration);

    const enforceSleepBoundary = data.meta.enforceSleepBoundary !== false;
    // Clamp the moved block to the day's sleep boundaries only when enforcement is enabled.
    const sleepForDay = enforceSleepBoundary
      ? buildAgendaForDate(data, date).filter((a) => a.kind === "sleep" && (a as { sleepBoundary?: boolean }).sleepBoundary)
      : [];
    const hasSleepBoundaryForDay = sleepForDay.length > 0;
    const wakeMin = sleepForDay
      .filter((a) => timeToMinutes(a.end) <= 12 * 60)
      .reduce((m, a) => Math.max(m, timeToMinutes(a.end)), 0);
    const bedMin = sleepForDay
      .filter((a) => timeToMinutes(a.start) >= 18 * 60)
      .reduce((m, a) => Math.min(m, timeToMinutes(a.start)), 24 * 60);
    const boundarySnapTol = 15;
    const sleepCuts = (data.meta.sleepCuts ?? [])
      .filter((c) => c.date === dayIso)
      .map((c) => ({ start: timeToMinutes(c.start), end: timeToMinutes(c.end) }))
      .filter((c) => c.end > c.start)
      .sort((a, b) => a.start - b.start);

    const findOverlappingSleepCut = (start: number, end: number) =>
      sleepCuts.find((c) => start < c.end && end > c.start) ?? null;

    const avoidSleepCut = (candidate: number, dur: number, preferForward: boolean) => {
      let nextStart = candidate;
      let guard = 0;
      while (guard < sleepCuts.length + 2) {
        guard += 1;
        const nextEnd = nextStart + dur;
        const overlap = findOverlappingSleepCut(nextStart, nextEnd);
        if (!overlap) return nextStart;

        const beforeStart = Math.max(wakeMin, Math.min(nextStart, overlap.start - dur));
        const beforeEnd = beforeStart + dur;
        const beforeValid = beforeStart >= wakeMin && beforeEnd <= overlap.start && !findOverlappingSleepCut(beforeStart, beforeEnd);

        const afterStart = Math.min(bedMin - dur, Math.max(nextStart, overlap.end));
        const afterEnd = afterStart + dur;
        const afterValid = afterStart >= overlap.end && afterEnd <= bedMin && !findOverlappingSleepCut(afterStart, afterEnd);

        if (beforeValid && afterValid) {
          nextStart = preferForward ? afterStart : beforeStart;
          continue;
        }
        if (afterValid) {
          nextStart = afterStart;
          continue;
        }
        if (beforeValid) {
          nextStart = beforeStart;
          continue;
        }
        return null;
      }
      return null;
    };

    const sourceSpansNextDay = sourceRoutine
      ? (sourceRoutine.endsNextDay ?? sourceRoutine.end <= sourceRoutine.start)
      : sourceCommitment
        ? (sourceCommitment.endsNextDay || resolveCommitmentEndDate(sourceCommitment) > sourceCommitment.date || sourceCommitment.end <= sourceCommitment.start)
        : false;

    const commitCrossdayMove = (absoluteStartMin: number) => {
      const dayOffset = Math.floor(absoluteStartMin / (24 * 60));
      const startInDay = ((absoluteStartMin % (24 * 60)) + 24 * 60) % (24 * 60);
      const endAbs = startInDay + movedDur;
      const start = minutesToTime(startInDay);
      const end = minutesToTime(endAbs % (24 * 60));
      const endsNextDay = endAbs > 24 * 60;
      const targetDay = (day + dayOffset + 7) % 7;
      const targetDate = addDaysToIso(dayIso, dayOffset);
      const targetEndDate = endsNextDay ? addDaysToIso(targetDate, 1) : targetDate;

      if (sourceRoutine) {
        const candidate: RoutineBlock = {
          ...sourceRoutine,
          day: targetDay,
          start,
          end,
          endsNextDay,
        };
        const sleepErr = validateRoutineSleepOverlap(data, candidate);
        if (sleepErr) return sleepErr;
        const candidateSegments = buildRoutineWeeklySegments(candidate);
        const conflict = data.routine.find((r) => {
          if (r.id === sourceRoutine.id) return false;
          const existingSegments = buildRoutineWeeklySegments(r);
          return candidateSegments.some((candidateSegment) =>
            existingSegments.some((existingSegment) =>
              candidateSegment.day === existingSegment.day
              && candidateSegment.startMin < existingSegment.endMin
              && existingSegment.startMin < candidateSegment.endMin,
            ),
          );
        });
        if (conflict) {
          return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
        }

        setData((d) => withDerived({
          ...d,
          routine: d.routine.map((r) =>
            r.id === sourceRoutine.id
              ? { ...r, day: targetDay, start, end, endsNextDay }
              : r,
          ),
        }));
        return null;
      }

      if (sourceCommitment) {
        const candidate: Commitment = {
          ...sourceCommitment,
          date: targetDate,
          start,
          end,
          endsNextDay,
          endDate: targetEndDate,
        };
        const sleepErr = validateCommitmentSleepOverlap(data, candidate);
        if (sleepErr) return sleepErr;
        const conflict = data.commitments.find((c) => c.id !== sourceCommitment.id && intervalsOverlap(commitmentInterval(c), commitmentInterval(candidate)));
        if (conflict) {
          return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
        }

        setData((d) => withDerived({
          ...d,
          commitments: d.commitments.map((c) =>
            c.id === sourceCommitment.id
              ? { ...c, date: targetDate, start, end, endsNextDay, endDate: targetEndDate }
              : c,
          ),
        }));
        return null;
      }

      return "Block not found.";
    };

    // Cross-day blocks keep total duration. Dragging changes how much spills into next day.
    if (sourceSpansNextDay) {
      const sourceReferenceStartMin = dragEdge === "top" ? sourceStartMin - 24 * 60 : sourceStartMin;
      const crossStart = typeof dragDeltaMin === "number" ? sourceReferenceStartMin + dragDeltaMin : movedStart;
      // At least 15 minutes must remain on the originating day.
      const minCrossStart = -(movedDur - 15);
      const clampedCrossStart = Math.max(crossStart, minCrossStart);
      return commitCrossdayMove(clampedCrossStart);
    }

    const rawCandidateStart = typeof dragDeltaMin === "number" ? sourceStartMin + dragDeltaMin : movedStart;
    const rawCandidateEnd = rawCandidateStart + movedDur;
    let candidateStart = rawCandidateStart;
    // Snap only when crossing into sleep, not when merely near the boundary.
    // Also skip snapping when there are no sleep boundaries at all (wakeMin/bedMin
    // are just defaults, not real boundaries).
    if (sleepForDay.length > 0 && wakeMin > 0 && rawCandidateStart < wakeMin && wakeMin - rawCandidateStart <= boundarySnapTol) {
      candidateStart = wakeMin;
    }
    if (sleepForDay.length > 0 && bedMin < 24 * 60 && rawCandidateEnd > bedMin && rawCandidateEnd - bedMin <= boundarySnapTol) {
      candidateStart = bedMin - movedDur;
    }

    const sleepEntry = data.meta.sleepSchedule?.length
      ? getSleepWindowForDay(data.meta.sleepSchedule, day)
      : null;
    const nextDaySleepEntry = data.meta.sleepSchedule?.length
      ? getSleepWindowForDay(data.meta.sleepSchedule, (day + 1) % 7)
      : null;
    const hasOvernightSleep = (entry: SleepScheduleEntry | null) =>
      entry !== null && entry.start !== entry.end && timeToMinutes(entry.start) > timeToMinutes(entry.end);
    const isWakeOnlySleep = (entry: SleepScheduleEntry | null) =>
      entry !== null && entry.start === "00:00" && entry.end !== "00:00";
    // Cross-day is allowed when there's no bed boundary at all, or when either
    // day in a cross-day transition has an overnight or wake-only boundary.
    const hasCrossDaySleep = enforceSleepBoundary
      ? (sleepEntry === null || sleepEntry.start === sleepEntry.end)
        || hasOvernightSleep(sleepEntry)
        || hasOvernightSleep(nextDaySleepEntry)
        || isWakeOnlySleep(sleepEntry)
      : true;

    if (hasCrossDaySleep && (candidateStart < 0 || candidateStart + movedDur > 24 * 60)) {
      // At least 15 minutes must remain on the originating day.
      const minCrossStart = -(movedDur - 15);
      const maxCrossStart = 24 * 60 - 15;
      const clampedCandidate = Math.max(minCrossStart, Math.min(candidateStart, maxCrossStart));
      return commitCrossdayMove(clampedCandidate);
    }

    const boundedStart = Math.max(wakeMin, Math.min(candidateStart, bedMin - movedDur));
    const preferredForward = movedStart >= sourceStartMin;
    const safeStart = avoidSleepCut(boundedStart, movedDur, preferredForward);
    if (safeStart === null) return "Cannot place block: overlaps a sleep break.";
    const clampedStart = safeStart;
    const clampedEnd = clampedStart + movedDur;

    const reordered = dayAgenda
      .map((a) => {
        if (a.id === id && a.source === source) {
          return { ...a, start: minutesToTime(clampedStart), end: minutesToTime(clampedEnd) };
        }
        return a;
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    const idx = reordered.findIndex((a) => a.id === id && a.source === source);
    if (idx < 0) return "Block not found.";

    const adjusted = reordered.map((a) => ({
      ...a,
      s: timeToMinutes(a.start),
      e: timeToMinutes(a.end),
      dur: Math.max(15, timeToMinutes(a.end) - timeToMinutes(a.start)),
    }));
    adjusted[idx].s = clampedStart;
    adjusted[idx].e = clampedStart + movedDur;
    adjusted[idx].dur = movedDur;

    if (idx > 0) {
      const minStart = adjusted[idx - 1].e;
      if (adjusted[idx].s < minStart) {
        adjusted[idx].s = minStart;
        adjusted[idx].e = adjusted[idx].s + adjusted[idx].dur;
      }
    }

    for (let i = idx + 1; i < adjusted.length; i += 1) {
      if (adjusted[i].s < adjusted[i - 1].e) {
        adjusted[i].s = adjusted[i - 1].e;
        adjusted[i].e = adjusted[i].s + adjusted[i].dur;
      } else {
        break;
      }
    }

    const MAX_END = bedMin;
    const overflow = adjusted.length > 0 ? adjusted[adjusted.length - 1].e - MAX_END : 0;
    if (overflow > 0) {
      for (let i = idx; i < adjusted.length; i += 1) {
        adjusted[i].s -= overflow;
        adjusted[i].e -= overflow;
      }
      if (adjusted[idx].s < 0) return "Cannot push more: reached day boundary.";
      for (let i = idx + 1; i < adjusted.length; i += 1) {
        adjusted[i].s = adjusted[i - 1].e;
        adjusted[i].e = adjusted[i].s + adjusted[i].dur;
      }
      if (adjusted[adjusted.length - 1].e > MAX_END) return "Cannot push more: reached sleep boundary.";
    }

    // Final safety pass: no adjusted block can end up inside the per-day sleep cut.
    if (sleepCuts.length > 0) {
      for (let i = 0; i < adjusted.length; i += 1) {
        const prevEnd = i > 0 ? adjusted[i - 1].e : wakeMin;
        let nextStart = Math.max(adjusted[i].s, prevEnd);
        let nextEnd = nextStart + adjusted[i].dur;

        const overlap = findOverlappingSleepCut(nextStart, nextEnd);
        if (overlap) {
          nextStart = overlap.end;
          nextEnd = nextStart + adjusted[i].dur;
          if (findOverlappingSleepCut(nextStart, nextEnd)) return "Cannot place block: overlaps a sleep break.";
        }

        if (nextEnd > MAX_END) return "Cannot place block: exceeds sleep boundary.";

        adjusted[i].s = nextStart;
        adjusted[i].e = nextEnd;
      }
    }

    const agendaMap = new Map(adjusted.map((a) => [
      `${a.source}:${a.id}`,
      { start: minutesToTime(Math.max(0, a.s)), end: minutesToTime(Math.min(MAX_END, a.e)) },
    ]));

    setData((d) => {
      const routine = d.routine.map((r) => {
        if (r.day !== day) return r;
        const adj = agendaMap.get(`routine:${r.id}`);
        if (!adj) return r;
        return {
          ...r,
          start: adj.start,
          end: adj.end,
          endsNextDay: adj.end <= adj.start,
        };
      });
      const commitments = d.commitments.map((c) => {
        const adj = agendaMap.get(`commitment:${c.id}`);
        return adj ? {
          ...c,
          start: adj.start,
          end: adj.end,
          endsNextDay: adj.end <= adj.start,
          endDate: (adj.end <= adj.start) ? addDaysToIso(c.date, 1) : c.date,
        } : c;
      });
      return withDerived({ ...d, routine, commitments });
    });
    return null;
  }, [data]);

  const updateSleepWindow = useCallback((patch: Partial<{ start: string; end: string }>) => {
    setData((d) => {
      const current = d.meta.sleepWindow ?? normalizeSleepWindow(d);
      const next = sanitizeSleepWindow({ ...current, ...patch }, d.meta.workdayStart);
      // Also update sleepSchedule to stay in sync (replace all-day entry)
      const prevSchedule = d.meta.sleepSchedule ?? migrateSleepSchedule(d);
      const nextSchedule = prevSchedule.some((e) => !e.days)
        ? prevSchedule.map((e) => !e.days ? { ...e, start: next.start, end: next.end } : e)
        : [{ start: next.start, end: next.end }, ...prevSchedule];
      return withDerived({ ...d, meta: { ...d.meta, sleepWindow: next, sleepSchedule: nextSchedule } });
    });
  }, []);

  const setSleepBoundaryEnforced = useCallback((enforced: boolean) => {
    setData((d) => withDerived(
      normalizeNamingModel(
        {
          ...d,
          meta: {
            ...d.meta,
            enforceSleepBoundary: enforced,
          },
        },
        locale,
      ),
      false,
      locale,
    ));
  }, [locale]);

  const setFocusCategories = useCallback((ids: string[]) => {
    setData((d) => withDerived(
      { ...d, meta: { ...d.meta, focusCategoryIds: ids.length > 0 ? ids : undefined } },
      false,
      locale,
    ));
  }, [locale]);

  const updateSleepSchedule = useCallback((schedule: SleepScheduleEntry[]) => {
    setData((d) => {
      // Keep sleepWindow in sync with the first all-day entry for legacy compat
      const allDay = schedule.find((e) => !e.days);
      const sleepWindow = allDay
        ? sanitizeSleepWindow({ start: allDay.start, end: allDay.end }, d.meta.workdayStart)
        : d.meta.sleepWindow;
      return withDerived({ ...d, meta: { ...d.meta, sleepSchedule: schedule, sleepWindow } });
    });
  }, []);

  const addSleepCut = useCallback((cut: SleepCut) => {
    setData((d) => {
      const incomingStart = timeToMinutes(cut.start);
      const incomingEnd = timeToMinutes(cut.end);
      const sameDate = (d.meta.sleepCuts ?? []).filter((c) => c.date === cut.date);
      const otherDates = (d.meta.sleepCuts ?? []).filter((c) => c.date !== cut.date);

      // Keep multiple per-day cuts, but drop any that overlap the new one.
      const sameDateWithoutOverlap = sameDate.filter((c) => {
        const start = timeToMinutes(c.start);
        const end = timeToMinutes(c.end);
        return end <= incomingStart || start >= incomingEnd;
      });

      const next = [...sameDateWithoutOverlap, cut].sort((a, b) => a.start.localeCompare(b.start));
      return withDerived({ ...d, meta: { ...d.meta, sleepCuts: [...otherDates, ...next] } });
    });
  }, []);

  const removeSleepCut = useCallback((target: { date: string; start?: string; end?: string }) => {
    setData((d) => {
      const cuts = (d.meta.sleepCuts ?? []).filter((c) => {
        if (c.date !== target.date) return true;
        if (target.start && target.end) {
          return !(c.start === target.start && c.end === target.end);
        }
        return false;
      });
      return withDerived({ ...d, meta: { ...d.meta, sleepCuts: cuts } });
    });
  }, []);

  const updateCategory = useCallback((id: Category["id"], patch: Partial<Pick<Category, "label" | "labelCustom" | "description" | "descriptionCustom" | "tone" | "color">>) => {
    setData((d) => withDerived({
      ...d,
      categories: d.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const addCategory = useCallback((cat: Category) => {
    setData((d) => withDerived({
      ...d,
      categories: [...d.categories, cat],
    }));
  }, []);

  const removeCategory = useCallback((id: Category["id"]) => {
    setData((d) => withDerived({
      ...d,
      categories: d.categories.filter((c) => c.id !== id),
      routine: d.routine.filter((r) => r.kind !== id),
      commitments: d.commitments.filter((c) => c.kind !== id),
      presets: d.presets.filter((p) => p.kind !== id),
    }));
  }, []);

  const resetCategoryNaming = useCallback((id: Category["id"]) => {
    setData((d) =>
      withDerived({
        ...d,
        categories: d.categories.map((c) =>
          c.id === id ? { ...c, labelCustom: undefined, descriptionCustom: undefined } : c,
        ),
      }),
    );
  }, []);

  const applySuggestion = useCallback((id: string) => {
    setData((d) => {
      const s = d.suggestions.find((x) => x.id === id);
      if (!s) return d;
      let routine = d.routine;
      if (s.patch?.type === "add-routine") {
        routine = [...routine, { ...s.patch.block, id: uid("r") }];
      } else if (s.patch?.type === "add-routines") {
        routine = [...routine, ...s.patch.blocks.map((b) => ({ ...b, id: uid("r") }))];
      } else if (s.patch?.type === "remove-routine") {
        const m = s.patch.match;
        routine = routine.filter(
          (r) => !(Object.keys(m) as (keyof RoutineBlock)[]).every((k) => r[k] === m[k]),
        );
      }
      return withDerived({ ...d, routine, suggestions: d.suggestions.filter((x) => x.id !== id) });
    });
  }, []);

  const deferSuggestion = useCallback((id: string) => {
    setData((d) => withDerived({ ...d, suggestions: d.suggestions.filter((x) => x.id !== id) }));
  }, []);

  const refreshSuggestions = useCallback(() => {
    setData((d) => withDerived(d, true, locale));
  }, [locale]);

  const resetToSeed = useCallback(() => setData(withDerived(normalizeNamingModel(getSeedForLocale(locale) as ScheduleData, locale), true, locale)), [locale]);
  const replace = useCallback((next: ScheduleData) => setData(withDerived(normalizeNamingModel(next, locale), true, locale)), [locale]);

  const value = useMemo(
    () => ({
      data,
      addRoutine,
      updateRoutine,
      removeRoutine,
      addCommitment,
      removeCommitment,
      updateCommitment,
      addPreset,
      removePreset,
      updatePreset,
      pushMoveDayChain,
      setSleepBoundaryEnforced,
      setFocusCategories,
      updateSleepWindow,
      updateSleepSchedule,
      addSleepCut,
      removeSleepCut,
      updateCategory,
      addCategory,
      removeCategory,
      resetCategoryNaming,
      applySuggestion,
      deferSuggestion,
      refreshSuggestions,
      resetToSeed,
      replace,
      addGoal,
      updateGoal,
      removeGoal,
      addGoalBlock,
      updateGoalBlock,
      removeGoalBlock,
      toggleGoalBlock,
      addGoalSubTask,
      toggleGoalSubTask,
      linkLooseCommitment,
      generateGoalCommitments,
      trackBlockForGoal,
      isBlockTrackedForAnyGoal,
      getGoalsForDate,
      overallGoalProgress,
      recordProgressSnapshots,
    }),
    [
      data,
      addRoutine,
      updateRoutine,
      removeRoutine,
      addCommitment,
      removeCommitment,
      updateCommitment,
      addPreset,
      removePreset,
      updatePreset,
      pushMoveDayChain,
      setSleepBoundaryEnforced,
      setFocusCategories,
      updateSleepWindow,
      updateSleepSchedule,
      addSleepCut,
      removeSleepCut,
      updateCategory,
      addCategory,
      removeCategory,
      resetCategoryNaming,
      applySuggestion,
      deferSuggestion,
      refreshSuggestions,
      resetToSeed,
      replace,
      addGoal,
      updateGoal,
      removeGoal,
      addGoalBlock,
      updateGoalBlock,
      removeGoalBlock,
      toggleGoalBlock,
      addGoalSubTask,
      toggleGoalSubTask,
      linkLooseCommitment,
      generateGoalCommitments,
      trackBlockForGoal,
      isBlockTrackedForAnyGoal,
      getGoalsForDate,
      overallGoalProgress,
      recordProgressSnapshots,
    ],
  );
  return <ScheduleCtx.Provider value={value}>{children}</ScheduleCtx.Provider>;
}

export function useSchedule() {
  const ctx = useContext(ScheduleCtx);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
}

/** Build today's agenda from routine + commitments for a given date. */
export function buildAgendaForDate(data: ScheduleData, date: Date) {
  const day = date.getDay();
  const iso = date.toISOString().slice(0, 10);
  const prevDay = (day + 6) % 7;
  const dayStart = toDateTime(iso, "00:00");
  const dayEnd = toDateTime(addDaysToIso(iso, 1), "00:00");
  const toTime = (d: Date, isEnd = false) => {
    if (isEnd && d.getTime() === dayEnd.getTime()) return "24:00";
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  const fromCommit = data.commitments.flatMap((c) => {
    if (!c.date) return [];
    const interval = commitmentInterval(c);
    if (!intervalsOverlap(interval, { start: dayStart, end: dayEnd })) return [];
    const segStart = interval.start > dayStart ? interval.start : dayStart;
    const segEnd = interval.end < dayEnd ? interval.end : dayEnd;
    if (segEnd <= segStart) return [];
    return [{
      id: c.id,
      sourceId: c.id,
      title: c.title,
      titleCustom: c.titleCustom,
      start: toTime(segStart),
      end: toTime(segEnd, true),
      continuesFromPrevDay: segStart.getTime() === dayStart.getTime() && interval.start < dayStart,
      continuesToNextDay: segEnd.getTime() === dayEnd.getTime() && interval.end > dayEnd,
      kind: c.kind,
      source: "commitment" as const,
      notes: c.notes,
    }];
  });

  const routineBlockers = fromCommit.map((c) => ({ start: c.start, end: c.end }));
  const fromRoutine = data.routine
    .filter((r) => r.day === day || ((r.endsNextDay ?? r.end <= r.start) && r.day === prevDay))
    .flatMap((r) => {
      const spans = r.endsNextDay ?? r.end <= r.start;
      const baseSegment =
        r.day === day
          ? { start: r.start, end: spans ? "24:00" : r.end }
          : { start: "00:00", end: r.end };
      const visibleSegments = subtractRanges(baseSegment, routineBlockers);
      return visibleSegments.map((segment, index) => ({
        id: visibleSegments.length === 1 ? r.id : `${r.id}::segment-${index}`,
        sourceId: r.id,
        derived: spans || visibleSegments.length > 1 || segment.start !== baseSegment.start || segment.end !== baseSegment.end,
        title: r.title,
        titleCustom: r.titleCustom,
        start: segment.start,
        end: segment.end,
        continuesFromPrevDay: r.day !== day && spans && segment.start === "00:00",
        continuesToNextDay: r.day === day && spans && segment.end === "24:00",
        kind: r.kind,
        source: "routine" as const,
        notes: r.notes,
      }));
    });

  const sleepTitle = data.categories.find((c) => c.id === "sleep")?.label ?? "Sleep";
  const sleepSchedule = data.meta.sleepSchedule ?? migrateSleepSchedule(data);
  const sleepEntry = getSleepWindowForDay(sleepSchedule, day);
  const sleepSegments = data.meta.enforceSleepBoundary === false || !sleepEntry || sleepEntry.start === sleepEntry.end
    ? []
    : buildSleepSegmentsForDate(sleepEntry, date, sleepTitle);

  return [...sleepSegments, ...fromRoutine, ...fromCommit].sort((a, b) => a.start.localeCompare(b.start));
}
