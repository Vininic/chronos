import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";

export function recoveryAnalysis(data: ScheduleData, _timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const hasSleepSchedule = data.meta.sleepSchedule && data.meta.sleepSchedule.length > 0;

  if (!hasSleepSchedule) {
    cards.push({
      kind: "recovery",
      severity: "insight",
      title: "Sleep schedule not configured",
      body: "No sleep windows are defined. The schedule has no awareness of rest periods.",
      actionable: true,
    });
  }

  if (_timeframe === "monthly") {
    const snapshots = data.progressSnapshots;
    if (snapshots.length > 3) {
      const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const firstRatio = first.denominator > 0 ? first.numerator / first.denominator : 0;
      const lastRatio = last.denominator > 0 ? last.numerator / last.denominator : 0;
      if (lastRatio < firstRatio - 0.1) {
        cards.push({
          kind: "recovery",
          severity: "insight",
          title: "Goal completion rate declined this month",
          body: `Completion ratio went from ${Math.round(firstRatio * 100)}% to ${Math.round(lastRatio * 100)}%.`,
        });
      }
    }
  }

  return cards;
}
