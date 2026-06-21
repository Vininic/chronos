import type { Commitment, RoutineBlock, ScheduleData, SleepCut, SleepScheduleEntry } from "./types";
import { timeToMinutes } from "./types";
import { minutesToTime, buildRoutineWeeklySegments, commitmentDaySlices } from "./helpers";

export function sanitizeSleepWindow(
  sleepWindow: { start: string; end: string },
  fallbackMorningEnd: string,
) {
  const s = timeToMinutes(sleepWindow.start);
  const e = timeToMinutes(sleepWindow.end);

  if (s >= 18 * 60 && e >= s && e >= 23 * 60 + 45) {
    return { start: sleepWindow.start, end: fallbackMorningEnd };
  }

  return sleepWindow;
}

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

export function migrateSleepSchedule(data: ScheduleData): SleepScheduleEntry[] {
  if (data.meta.sleepSchedule && data.meta.sleepSchedule.length > 0) {
    return data.meta.sleepSchedule;
  }
  const win = data.meta.sleepWindow ?? legacySleepWindowFromRoutine(data);
  return [{ start: win.start, end: win.end }];
}

export function getSleepWindowForDay(schedule: SleepScheduleEntry[], dayOfWeek: number): SleepScheduleEntry | null {
  const perDay = schedule.find((e) => e.days?.includes(dayOfWeek));
  if (perDay) return perDay;
  return schedule.find((e) => !e.days) ?? null;
}

export function normalizeSleepWindow(data: ScheduleData): { start: string; end: string } {
  if (data.meta.sleepWindow) return sanitizeSleepWindow(data.meta.sleepWindow, data.meta.workdayStart);
  return legacySleepWindowFromRoutine(data);
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

export function validateRoutineSleepOverlap(data: ScheduleData, candidate: Pick<RoutineBlock, "day" | "start" | "end" | "endsNextDay">) {
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

export function validateCommitmentSleepOverlap(data: ScheduleData, candidate: Pick<Commitment, "date" | "start" | "end" | "endDate" | "endsNextDay">) {
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

export function buildSleepSegmentsForDate(
  sleepWindow: { start: string; end: string },
  date: Date,
  sleepTitle: string,
) {
  const iso = date.toISOString().slice(0, 10);
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

export function getSleepCutForDate(data: ScheduleData, isoDate: string): SleepCut[] {
  return (data.meta.sleepCuts ?? []).filter((c) => c.date === isoDate);
}

export function getActiveSleepWindows(data: ScheduleData, day: number, dateIso?: string) {
  const schedule = data.meta.sleepSchedule ?? migrateSleepSchedule(data);
  return sleepBlockedIntervalsForDay(schedule, day, data.meta.sleepCuts, dateIso);
}
