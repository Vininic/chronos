import { timeToMinutes } from "./types";

export const TEASE_MIN = 15;
export const COMMIT_MIN = 30;
export const MIN_IN_DAY = 15;

export function sleepCutsToRanges(
  sleepCuts: Array<{ date: string; start: string; end: string }>,
  dateIso: string,
): Array<{ start: number; end: number }> {
  return (sleepCuts ?? [])
    .filter((c) => c.date === dateIso)
    .map((c) => ({ start: timeToMinutes(c.start), end: timeToMinutes(c.end) }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start);
}

export function intersectsSleepCut(
  start: number,
  end: number,
  ranges: Array<{ start: number; end: number }>,
): boolean {
  return ranges.some((c) => start < c.end && end > c.start);
}

export function clampStartAvoidingSleepCuts(
  candidateStart: number,
  dur: number,
  minStart: number,
  maxStart: number,
  ranges: Array<{ start: number; end: number }>,
  preferForward: boolean,
): number | null {
  let nextStart = Math.max(minStart, Math.min(candidateStart, maxStart));
  let guard = 0;
  while (guard < ranges.length + 3) {
    guard += 1;
    const nextEnd = nextStart + dur;
    const overlap = ranges.find((c) => nextStart < c.end && nextEnd > c.start);
    if (!overlap) return nextStart;

    const beforeStart = Math.max(minStart, Math.min(nextStart, overlap.start - dur));
    const beforeEnd = beforeStart + dur;
    const beforeValid = beforeStart >= minStart && beforeEnd <= maxStart + dur && !intersectsSleepCut(beforeStart, beforeEnd, ranges);

    const afterStart = Math.min(maxStart, Math.max(nextStart, overlap.end));
    const afterEnd = afterStart + dur;
    const afterValid = afterStart <= maxStart && afterEnd <= maxStart + dur && !intersectsSleepCut(afterStart, afterEnd, ranges);

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
}
