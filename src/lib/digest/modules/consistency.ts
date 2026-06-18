import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";

export function consistencyAnalysis(data: ScheduleData): ReportCard[] {
  const cards: ReportCard[] = [];
  const goals = data.goals;
  const today = new Date().toISOString().slice(0, 10);

  const activeGoals = goals.filter((g) => g.period !== "total");
  if (activeGoals.length === 0) return cards;

  const weakGoals = activeGoals.filter((g) => {
    const streak = (g as unknown as { _streak?: number })._streak ?? 0;
    return streak === 0 && g.blocks.length > 0;
  });

  if (weakGoals.length > 0) {
    const names = weakGoals.slice(0, 2).map((g) => `"${g.title}"`).join(", ");
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

  return cards;
}
