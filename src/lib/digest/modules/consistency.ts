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
      title: `${weakGoals.length} goal${weakGoals.length > 1 ? "s" : ""} with no active streak`,
      body: weakGoals.length <= 2
        ? `${names} ${weakGoals.length > 1 ? "have" : "has"} no active streak.`
        : `${weakGoals.length} goals have no active streak.`,
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
          severity: "insight",
          title: `Monthly consistency rate: ${consistencyRate}%`,
          body: `${doneSnapshots} of ${totalSnapshots} tracked goal periods completed this month.`,
        });
      } else if (consistencyRate >= 80) {
        cards.push({
          kind: "consistency",
          severity: "insight",
          title: `Monthly consistency rate: ${consistencyRate}%`,
          body: `${doneSnapshots} of ${totalSnapshots} goal periods completed.`,
        });
      }
    }
  }

  return cards;
}
