import type { ScheduleData } from "@/lib/schedule/types";
import { durationMin, timeToMinutes } from "@/lib/schedule/types";
import { buildAgendaForDate } from "@/lib/schedule/agenda";
import type { DigestTimeframe } from "../types";

/** A single concrete block instance on a specific calendar date. */
export interface DigestBlock {
  id: string;
  kind: string;
  title: string;
  start: string; // HH:MM
  end: string;   // HH:MM ("24:00" allowed)
  durationMin: number;
  day: number;   // weekday 0-6 of the date it falls on
  date: string;  // YYYY-MM-DD
  source: "routine" | "commitment";
}

export interface DigestDay {
  date: string;
  day: number;
  blocks: DigestBlock[]; // non-sleep, sorted by start
}

/**
 * Everything a digest module needs, computed once. The key fix over the old
 * `getBlocksForTimeframe`: this expands the routine AND commitments across the
 * *actual* date range for the timeframe, so weekly ≠ monthly and commitments
 * are no longer invisible.
 */
export interface DigestContext {
  timeframe: DigestTimeframe;
  range: { start: string; end: string }; // inclusive ISO dates
  dayCount: number;                       // distinct calendar days in range
  days: DigestDay[];                      // per-day, chronological
  blocks: DigestBlock[];                  // all non-sleep instances, flat
}

const MAX_RANGE_DAYS = 92;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local-noon Date for an ISO date string (avoids TZ date-shift). */
function noon(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

export function rangeForTimeframe(
  timeframe: DigestTimeframe,
  custom?: { start: string; end: string },
): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (timeframe) {
    case "daily": {
      const t = isoLocal(now);
      return { start: t, end: t };
    }
    case "weekly": {
      const dow = now.getDay(); // 0 = Sunday
      const sun = new Date(y, m, now.getDate() - dow, 12);
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);
      return { start: isoLocal(sun), end: isoLocal(sat) };
    }
    case "monthly": {
      const first = new Date(y, m, 1, 12);
      const last = new Date(y, m + 1, 0, 12); // day 0 of next month = last day
      return { start: isoLocal(first), end: isoLocal(last) };
    }
    case "custom": {
      if (custom?.start && custom?.end) {
        return custom.start <= custom.end
          ? { start: custom.start, end: custom.end }
          : { start: custom.end, end: custom.start };
      }
      const t = isoLocal(now);
      return { start: t, end: t };
    }
  }
}

function eachDate(startIso: string, endIso: string): Date[] {
  const out: Date[] = [];
  const cursor = noon(startIso);
  const end = noon(endIso);
  let guard = 0;
  while (cursor <= end && guard < MAX_RANGE_DAYS) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return out;
}

export function buildDigestContext(
  data: ScheduleData,
  timeframe: DigestTimeframe,
  custom?: { start: string; end: string },
): DigestContext {
  const range = rangeForTimeframe(timeframe, custom);
  const dates = eachDate(range.start, range.end);

  const days: DigestDay[] = dates.map((date) => {
    const iso = isoLocal(date);
    const blocks: DigestBlock[] = buildAgendaForDate(data, date)
      .filter((a) => a.kind !== "sleep")
      .map((a) => ({
        id: String(a.id ?? `${iso}-${a.start}`),
        kind: a.kind,
        title: a.titleCustom ?? a.title ?? "",
        start: a.start,
        end: a.end,
        durationMin: durationMin(a.start, a.end),
        day: date.getDay(),
        date: iso,
        source: a.source,
      }))
      .sort((x, y) => timeToMinutes(x.start) - timeToMinutes(y.start));
    return { date: iso, day: date.getDay(), blocks };
  });

  return {
    timeframe,
    range,
    dayCount: Math.max(days.length, 1),
    days,
    blocks: days.flatMap((d) => d.blocks),
  };
}

/* ── Shared classification helpers (no hardcoded category lists) ── */

export function isFocusKind(kind: string, data: ScheduleData): boolean {
  return (data.meta.focusCategoryIds ?? []).includes(kind);
}

/** Category ids whose role is "recovery" — replaces the hardcoded "recovery" id. */
export function recoveryKindSet(data: ScheduleData): Set<string> {
  return new Set(data.categories.filter((c) => c.role === "recovery").map((c) => c.id));
}

export function categoryLabel(data: ScheduleData, kind: string): string {
  const cat = data.categories.find((c) => c.id === kind);
  return cat?.labelCustom ?? cat?.label ?? kind;
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Minutes scheduled per weekday across the whole range. */
export function minutesByWeekday(ctx: DigestContext): Map<number, number> {
  const map = new Map<number, number>();
  for (const b of ctx.blocks) {
    map.set(b.day, (map.get(b.day) ?? 0) + b.durationMin);
  }
  return map;
}

/** Total minutes per category id across the range. */
export function minutesByCategory(ctx: DigestContext): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of ctx.blocks) {
    map.set(b.kind, (map.get(b.kind) ?? 0) + b.durationMin);
  }
  return map;
}

export function totalMinutes(ctx: DigestContext): number {
  return ctx.blocks.reduce((s, b) => s + b.durationMin, 0);
}
