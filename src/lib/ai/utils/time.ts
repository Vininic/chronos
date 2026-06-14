import type { ScheduleContext } from "../context/ScheduleContext";

export function parseMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

export function fmtMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function findGaps(
  ctx: ScheduleContext,
  minGapMin = 30,
): { start: string; end: string; durationMin: number }[] {
  if (ctx.blocks.length === 0) {
    const d = parseMin(ctx.workday.end) - parseMin(ctx.workday.start);
    return d >= minGapMin
      ? [{ start: ctx.workday.start, end: ctx.workday.end, durationMin: d }]
      : [];
  }

  const gaps: { start: string; end: string; durationMin: number }[] = [];
  const workdayStart = parseMin(ctx.workday.start);
  const workdayEnd = parseMin(ctx.workday.end);
  const sorted = [...ctx.blocks].sort((a, b) => parseMin(a.start) - parseMin(b.start));

  let cursor = workdayStart;
  for (const b of sorted) {
    const bStart = parseMin(b.start);
    const bEnd = parseMin(b.end);
    if (bStart > cursor + minGapMin) {
      gaps.push({ start: fmtMin(cursor), end: fmtMin(bStart), durationMin: bStart - cursor });
    }
    cursor = Math.max(cursor, bEnd);
  }
  if (workdayEnd > cursor + minGapMin) {
    gaps.push({ start: fmtMin(cursor), end: fmtMin(workdayEnd), durationMin: workdayEnd - cursor });
  }

  return gaps;
}
