import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";
import { timeToMinutes, fmtDur } from "@/lib/schedule/types";
import type { DigestContext, DigestBlock, DigestDay } from "./helpers";
import { WEEKDAY_NAMES, isRecoveryKind } from "./helpers";

const BREAK_GAP_MIN = 15;      // a gap >= this counts as a real break
const LONG_STRETCH_MIN = 4 * 60; // continuous activity beyond this is a burnout flag

function endMin(b: DigestBlock): number {
  return b.end === "24:00" ? 1440 : timeToMinutes(b.end);
}

/** Longest run of back-to-back non-recovery blocks (gaps < BREAK_GAP_MIN), in minutes. */
function longestStretch(day: DigestDay): { minutes: number; from: string; to: string } {
  const blocks = day.blocks.filter((b) => !isRecoveryKind(b.kind));
  let best = { minutes: 0, from: "", to: "" };
  let runStart = 0;
  let runEnd = 0;
  let runFrom = "";
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (i === 0) {
      runStart = timeToMinutes(b.start);
      runFrom = b.start;
    } else {
      const gap = timeToMinutes(b.start) - runEnd;
      if (gap >= BREAK_GAP_MIN) {
        runStart = timeToMinutes(b.start);
        runFrom = b.start;
      }
    }
    runEnd = endMin(b);
    const span = runEnd - runStart;
    if (span > best.minutes) best = { minutes: span, from: runFrom, to: b.end };
  }
  return best;
}

export function burnoutAnalysis(data: ScheduleData, ctx: DigestContext): ReportCard[] {
  const cards: ReportCard[] = [];

  // ── Longest continuous activity without a break ─────────────────────
  let worst = { minutes: 0, from: "", to: "", day: -1 };
  for (const day of ctx.days) {
    const s = longestStretch(day);
    if (s.minutes > worst.minutes) worst = { ...s, day: day.day };
  }
  if (worst.minutes >= LONG_STRETCH_MIN) {
    cards.push({
      kind: "burnout",
      severity: "warning",
      title: `${fmtDur(worst.minutes)} of continuous activity without a break`,
      body: `${ctx.timeframe === "daily" ? "Today" : WEEKDAY_NAMES[worst.day]} runs ${worst.from}–${worst.to} with no 15-minute gap. Consider inserting a recovery block.`,
      actionable: true,
    });
  }

  // ── Days carrying load but zero recovery ────────────────────────────
  if (ctx.dayCount > 1) {
    const loadedDays = ctx.days.filter((d) => d.blocks.length > 0);
    const noRecoveryDays = loadedDays.filter((d) => !d.blocks.some((b) => isRecoveryKind(b.kind)));
    if (loadedDays.length > 0 && noRecoveryDays.length >= Math.ceil(loadedDays.length / 2)) {
      cards.push({
        kind: "burnout",
        severity: noRecoveryDays.length === loadedDays.length ? "warning" : "insight",
        title: `${noRecoveryDays.length} of ${loadedDays.length} active days have no recovery block`,
        body: "Recovery blocks are sparse this period. Sustained load without scheduled rest raises burnout risk.",
        actionable: true,
      });
    }
  }

  // ── Monthly completion-rate decline (trend from snapshots) ──────────
  if (ctx.timeframe === "monthly") {
    const snapshots = data.progressSnapshots;
    if (snapshots.length > 3) {
      const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
      const mid = Math.floor(sorted.length / 2);
      const ratio = (arr: typeof sorted) =>
        arr.reduce((s, snap) => s + (snap.denominator > 0 ? snap.numerator / snap.denominator : 0), 0) / Math.max(arr.length, 1);
      const firstAvg = ratio(sorted.slice(0, mid));
      const secondAvg = ratio(sorted.slice(mid));
      if (secondAvg < firstAvg - 0.15) {
        cards.push({
          kind: "burnout",
          severity: "insight",
          title: "Completion rate declined over the month",
          body: `Average goal completion dropped from ${Math.round(firstAvg * 100)}% to ${Math.round(secondAvg * 100)}% — a possible early sign of overcommitment.`,
        });
      }
    }
  }

  return cards;
}
