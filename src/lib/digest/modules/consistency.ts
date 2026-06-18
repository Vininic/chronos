import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";

export function consistencyAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const goals = data.goals;

  const activeGoals = goals.filter((g: { period: string }) => g.period !== "total");
  if (activeGoals.length === 0) return cards;

  const weakGoals = activeGoals.filter((g: { blocks: unknown[]; _streak?: number }) => {
    const streak = (g as { _streak?: number })._streak ?? 0;
    return streak === 0 && g.blocks.length > 0;
  });

  if (weakGoals.length > 0) {
    const names = weakGoals.slice(0, 2).map((g: { title: string }) => `"${g.title}"`).join(", ");
    cards.push({
      kind: "consistency",
      severity: "trend",
      title: `${weakGoals.length} goal${weakGoals.length > 1 ? "s" : ""} showing inconsistency`,
      body: weakGoals.length <= 2
        ? `${names} ${weakGoals.length > 1 ? "have" : "has"} no active streak. Consistency drives long-term progress.`
        : `${weakGoals.length} goals have no active streak. Consider reducing goal count or adjusting targets.`,
      actionable: true,
    });
  }

  if (timeframe === "monthly") {
    const snapshots = data.progressSnapshots;
    if (snapshots.length > 0) {
      const totalSnapshots = snapshots.length;
      const doneSnapshots = snapshots.filter((s: { numerator: number; denominator: number }) => s.denominator > 0 && s.numerator >= s.denominator).length;
      const consistencyRate = Math.round((doneSnapshots / totalSnapshots) * 100);
      if (consistencyRate < 60) {
        cards.push({
          kind: "consistency",
          severity: "warning",
          title: `Monthly consistency rate: ${consistencyRate}%`,
          body: `Only ${doneSnapshots} out of ${totalSnapshots} tracked goal periods were completed this month. Consistency below 60% suggests goals may need adjustment.`,
          actionable: true,
        });
      } else if (consistencyRate >= 80) {
        cards.push({
          kind: "consistency",
          severity: "trend",
          title: `Strong monthly consistency: ${consistencyRate}%`,
          body: `${doneSnapshots} out of ${totalSnapshots} goal periods completed. Your consistency this month is excellent.`,
        });
      }
    }
  }

  return cards;
}
