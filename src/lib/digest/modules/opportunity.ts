import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";
import { timeToMinutes, fmtDur } from "@/lib/schedule/types";
import type { DigestContext, DigestBlock, DigestDay } from "./helpers";
import { WEEKDAY_NAMES, categoryLabel, minutesByCategory, totalMinutes } from "./helpers";

function endMin(b: DigestBlock): number {
  return b.end === "24:00" ? 1440 : timeToMinutes(b.end);
}

/** Largest open gap between consecutive blocks within a day's active window. */
function largestGap(day: DigestDay): { start: string; end: string; minutes: number } | null {
  const sorted = [...day.blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  let best: { start: string; end: string; minutes: number } | null = null;
  for (let i = 1; i < sorted.length; i++) {
    const gap = timeToMinutes(sorted[i].start) - endMin(sorted[i - 1]);
    if (gap > 0 && (!best || gap > best.minutes)) {
      best = { start: sorted[i - 1].end, end: sorted[i].start, minutes: gap };
    }
  }
  return best;
}

export function opportunityAnalysis(data: ScheduleData, ctx: DigestContext): ReportCard[] {
  const cards: ReportCard[] = [];

  // ── Largest open block today (deep-work opportunity) ────────────────
  if (ctx.timeframe === "daily" && ctx.days[0]) {
    const gap = largestGap(ctx.days[0]);
    if (gap && gap.minutes >= 60) {
      cards.push({
        kind: "opportunity",
        severity: "opportunity",
        title: `${fmtDur(gap.minutes)} open from ${gap.start} to ${gap.end}`,
        body: "Your largest free stretch today — a natural slot for a deep-work session or a longer recovery block.",
        actionable: true,
      });
    }
  }

  // ── Empty days in a multi-day window ────────────────────────────────
  if (ctx.dayCount > 1) {
    const empty = ctx.days.filter((d) => d.blocks.length === 0);
    if (empty.length > 0 && empty.length < ctx.dayCount) {
      const names = empty.map((d) => WEEKDAY_NAMES[d.day]).slice(0, 3).join(", ");
      cards.push({
        kind: "opportunity",
        severity: "opportunity",
        title: `${empty.length} open day${empty.length > 1 ? "s" : ""} with nothing scheduled`,
        body: `${names}${empty.length > 3 ? "…" : ""} ${empty.length > 1 ? "are" : "is"} free — room for a goal block or deliberate rest.`,
      });
    }
  }

  // ── Category balance: where the time actually goes ──────────────────
  const total = totalMinutes(ctx);
  if (total > 0) {
    const byCat = [...minutesByCategory(ctx).entries()].sort((a, b) => b[1] - a[1]);
    if (byCat.length >= 2) {
      const [topId, topMin] = byCat[0];
      const share = Math.round((topMin / total) * 100);
      if (share >= 40) {
        cards.push({
          kind: "opportunity",
          severity: "insight",
          title: `Most time goes to ${categoryLabel(data, topId)} (${share}%)`,
          body: `${fmtDur(topMin)} of ${fmtDur(total)} across ${byCat.length} categories. Worth checking this matches your priorities.`,
        });
      }
    }
  }

  // ── Monthly: deadlines landing this month ───────────────────────────
  if (ctx.timeframe === "monthly") {
    const month = new Date().toISOString().slice(0, 7);
    const due = data.goals.filter(
      (g) => g.kind === "deadline" && g.deadline && g.deadline.startsWith(month),
    );
    if (due.length > 0) {
      cards.push({
        kind: "opportunity",
        severity: "warning",
        title: `${due.length} deadline${due.length > 1 ? "s" : ""} due this month`,
        body: due.map((g) => `"${g.title}" (${g.deadline})`).join(", "),
        actionable: true,
      });
    }
  }

  return cards;
}
