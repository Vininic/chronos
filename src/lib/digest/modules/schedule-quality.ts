import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";
import { timeToMinutes } from "@/lib/schedule/types";
import type { DigestContext, DigestBlock } from "./helpers";
import { WEEKDAY_NAMES, totalMinutes } from "./helpers";

function endMin(b: DigestBlock): number {
  return b.end === "24:00" ? 1440 : timeToMinutes(b.end);
}

export function scheduleQualityAnalysis(_data: ScheduleData, ctx: DigestContext): ReportCard[] {
  const cards: ReportCard[] = [];
  const { timeframe } = ctx;

  // ── Real overlaps (deterministic, per-day) ──────────────────────────
  // Within a single day the agenda builder already subtracts commitments from
  // routine, so any genuine overlap here is a real data problem worth flagging.
  for (const day of ctx.days) {
    const sorted = [...day.blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (timeToMinutes(curr.start) < endMin(prev)) {
        cards.push({
          kind: "schedule-quality",
          severity: "warning",
          title: "Overlapping blocks detected",
          body: `On ${WEEKDAY_NAMES[day.day]}, "${curr.title}" (${curr.start}) starts before "${prev.title}" ends (${prev.end}).`,
          actionable: true,
        });
        break; // one per day is enough
      }
    }
  }

  // ── Tight transitions (<15 min gap), counted per day ────────────────
  let tightTransitions = 0;
  for (const day of ctx.days) {
    for (let i = 1; i < day.blocks.length; i++) {
      const gap = timeToMinutes(day.blocks[i].start) - endMin(day.blocks[i - 1]);
      if (gap >= 0 && gap < 15) tightTransitions++;
    }
  }
  if (tightTransitions > 0) {
    const perDay = tightTransitions / ctx.dayCount;
    cards.push({
      kind: "schedule-quality",
      severity: perDay >= 3 ? "warning" : "insight",
      title: `${tightTransitions} tight transition${tightTransitions > 1 ? "s" : ""}${timeframe === "daily" ? " today" : ""}`,
      body: ctx.dayCount > 1
        ? `Averaging ${perDay.toFixed(1)} per day — blocks starting within 15 minutes of the previous one. Little time to reset between activities.`
        : `${tightTransitions} block${tightTransitions > 1 ? "s start" : " starts"} within 15 minutes of the previous block's end.`,
    });
  }

  // ── Context switches (different category back-to-back), per day ──────
  let contextSwitches = 0;
  for (const day of ctx.days) {
    for (let i = 1; i < day.blocks.length; i++) {
      if (day.blocks[i].kind !== day.blocks[i - 1].kind) contextSwitches++;
    }
  }
  if (contextSwitches > 0 && ctx.blocks.length >= 4) {
    const perDay = Math.round(contextSwitches / ctx.dayCount);
    cards.push({
      kind: "schedule-quality",
      severity: "insight",
      title: `${perDay > 0 ? perDay : contextSwitches} context switch${(perDay || contextSwitches) > 1 ? "es" : ""}${ctx.dayCount > 1 ? " per day" : " today"}`,
      body: "Transitions between different block types. Grouping similar work reduces switching cost.",
    });
  }

  // ── Scheduled load per day ──────────────────────────────────────────
  if (ctx.blocks.length > 0) {
    const avgPerDay = totalMinutes(ctx) / ctx.dayCount;
    cards.push({
      kind: "schedule-quality",
      severity: "insight",
      title: `Averaging ${(avgPerDay / 60).toFixed(1)}h scheduled per day`,
      body: `${ctx.blocks.length} non-sleep block${ctx.blocks.length > 1 ? "s" : ""} across ${ctx.dayCount} day${ctx.dayCount > 1 ? "s" : ""}.`,
    });
  }

  return cards;
}
