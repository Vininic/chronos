import type { Commitment, RoutineBlock } from "./types";
import { timeToMinutes } from "./types";
import { DICTIONARIES, type Locale } from "@/lib/i18n/dictionaries";

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export function minutesToTime(min: number) {
  if (min >= 24 * 60) return "24:00";
  const clamped = Math.max(0, Math.min(23 * 60 + 59, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function dayFromIsoDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).getDay();
}

export function dateToIso(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function toDateTime(isoDate: string, time: string) {
  return new Date(`${isoDate}T${time}:00`);
}

export function addDaysToIso(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateToIso(d);
}

export function getDayLabel(day: number, locale: Locale): string {
  return DICTIONARIES[locale].common.days.long[day];
}

export function overlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && bs < ae;
}

export function intersectsClockRange(
  rangeStart: string,
  rangeEnd: string,
  blockStart: string,
  blockEnd: string,
) {
  return overlap(rangeStart, rangeEnd, blockStart, blockEnd);
}

export function subtractRanges(
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

export function intervalsOverlap(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && b.start < a.end;
}

export function resolveCommitmentEndDate(c: Pick<Commitment, "date" | "start" | "end" | "endDate" | "endsNextDay">) {
  if (!c.date) return c.date;
  if (c.endDate) return c.endDate;
  if (c.endsNextDay || c.end <= c.start) return addDaysToIso(c.date, 1);
  return c.date;
}

export function commitmentInterval(c: Pick<Commitment, "date" | "start" | "end" | "endDate" | "endsNextDay">) {
  if (!c.date) return { start: new Date(NaN), end: new Date(NaN) };
  const start = toDateTime(c.date, c.start);
  const end = toDateTime(resolveCommitmentEndDate(c)!, c.end);
  return { start, end };
}

export function commitmentDaySlices(c: Pick<Commitment, "date" | "start" | "end" | "endDate" | "endsNextDay">) {
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

export function buildRoutineWeeklySegments(r: Pick<RoutineBlock, "day" | "start" | "end" | "endsNextDay">) {
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

export function sortedDayBlocks(routine: RoutineBlock[], day: number) {
  return routine
    .filter((r) => r.day === day)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function findGap(routine: RoutineBlock[], day: number, startBound: string, endBound: string, minDuration = 60) {
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

export function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

export function getConflictMessage(type: "blockRoutine" | "blockCommitment" | "routineCommitment", title: string, start: string, end: string, locale: Locale): string {
  const conflicts = DICTIONARIES[locale].chronos.store.conflicts;
  return conflicts[type](title, start, end);
}
