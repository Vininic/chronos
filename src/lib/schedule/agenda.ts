import type { ScheduleData, WorkspaceRuntime } from "./types";
import { timeToMinutes } from "./types";
import { dateToIso, toDateTime, addDaysToIso, subtractRanges, commitmentInterval, intervalsOverlap } from "./helpers";
import { getSleepWindowForDay, migrateSleepSchedule, buildSleepSegmentsForDate } from "./sleep";

export interface AgendaItem {
  id: string;
  sourceId?: string;
  title: string;
  titleCustom?: string;
  notes?: string;
  start: string;
  end: string;
  kind: string;
  source: "routine" | "commitment";
  derived?: boolean;
  continuesFromPrevDay?: boolean;
  continuesToNextDay?: boolean;
  workspace?: WorkspaceRuntime;
  sleepBoundary?: boolean;
}

export function buildAgendaForDate(data: ScheduleData, date: Date): AgendaItem[] {
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
      workspace: c.workspace,
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
        workspace: r.workspace,
      }));
    });

  const sleepTitle = data.categories.find((c) => c.id === "sleep")?.label ?? "Sleep";
  const sleepSchedule = data.meta.sleepSchedule ?? migrateSleepSchedule(data);
  const sleepEntry = getSleepWindowForDay(sleepSchedule, day);
  const sleepSegments = data.meta.enforceSleepBoundary === false || !sleepEntry || sleepEntry.start === sleepEntry.end
    ? []
    : buildSleepSegmentsForDate(sleepEntry as { start: string; end: string }, date, sleepTitle);

  return [...sleepSegments, ...fromRoutine, ...fromCommit].sort((a, b) => a.start.localeCompare(b.start));
}
