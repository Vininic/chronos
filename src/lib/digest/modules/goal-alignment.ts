import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";

export function goalAlignmentAnalysis(data: ScheduleData, _timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const goals = data.goals;

  if (goals.length === 0) {
    cards.push({
      kind: "goal-alignment",
      severity: "insight",
      title: "No goals set",
      body: "Setting goals helps align daily actions with long-term priorities. Consider defining at least one goal to track.",
      actionable: true,
    });
    return cards;
  }

  const highPriority = goals.filter((g) => g.weight >= 3);
  if (highPriority.length > 0) {
    const goalNames = highPriority.slice(0, 3).map((g) => `"${g.title}"`).join(", ");
    cards.push({
      kind: "goal-alignment",
      severity: "insight",
      title: `${highPriority.length} high-priority goal${highPriority.length > 1 ? "s" : ""} tracked`,
      body: `Your top priority goal${highPriority.length > 1 ? "s" : ""} ${highPriority.length > 1 ? "are" : "is"} ${goalNames}. Review whether today's schedule allocated time toward these.`,
    });
  }

  const deadlineGoals = goals.filter((g) => g.kind === "deadline" && g.deadline);
  if (deadlineGoals.length > 0) {
    const approaching = deadlineGoals.filter((g) => {
      if (!g.deadline) return false;
      const daysLeft = Math.round((new Date(g.deadline).getTime() - Date.now()) / 86400000);
      return daysLeft >= 0 && daysLeft <= 7;
    });
    if (approaching.length > 0) {
      cards.push({
        kind: "goal-alignment",
        severity: "warning",
        title: `${approaching.length} deadline${approaching.length > 1 ? "s" : ""} approaching`,
        body: approaching.map((g) => `"${g.title}" ${g.deadline ? `(due ${g.deadline})` : ""}`).join(", "),
      });
    }
  }

  return cards;
}
