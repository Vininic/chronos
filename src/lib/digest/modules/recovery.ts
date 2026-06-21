import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";
import { fmtDur } from "@/lib/schedule/types";
import type { DigestContext } from "./helpers";
import { isRecoveryKind, totalMinutes } from "./helpers";

export function recoveryAnalysis(data: ScheduleData, ctx: DigestContext): ReportCard[] {
  const cards: ReportCard[] = [];

  // ── Sleep schedule configured? (single source of truth for this card) ──
  const hasSleepSchedule = !!data.meta.sleepSchedule && data.meta.sleepSchedule.length > 0;
  if (!hasSleepSchedule) {
    cards.push({
      kind: "recovery",
      severity: "warning",
      title: "Sleep schedule not configured",
      body: "No sleep windows are defined, so the schedule has no awareness of rest periods. Set one to unlock recovery analysis.",
      actionable: true,
    });
  }

  // ── Recovery share of scheduled time ────────────────────────────────
  const total = totalMinutes(ctx);
  if (total > 0) {
    const recoveryMin = ctx.blocks
      .filter((b) => isRecoveryKind(b.kind))
      .reduce((s, b) => s + b.durationMin, 0);
    const pct = Math.round((recoveryMin / total) * 100);

    if (recoveryMin === 0) {
      cards.push({
        kind: "recovery",
        severity: "warning",
        title: "No recovery time scheduled",
        body: `None of the ${fmtDur(total)} scheduled this ${ctx.timeframe === "daily" ? "day" : "period"} is recovery. Active rest protects focus and prevents fatigue accumulation.`,
        actionable: true,
      });
    } else if (pct < 10) {
      cards.push({
        kind: "recovery",
        severity: "insight",
        title: `Recovery is ${pct}% of scheduled time`,
        body: `${fmtDur(recoveryMin)} of recovery against ${fmtDur(total)} of activity. Below ~10% tends to feel relentless over a full week.`,
      });
    }
  }

  return cards;
}
