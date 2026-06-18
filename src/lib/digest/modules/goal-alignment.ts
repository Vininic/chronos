import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";

export function goalAlignmentAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const goals = data.goals;
  const snapshots = data.progressSnapshots;

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
      body: timeoutLabel(timeframe) + `Your top priority goal${highPriority.length > 1 ? "s" : ""} ${highPriority.length > 1 ? "are" : "is"} ${goalNames}. ${timeframe === "daily" ? "Review whether today's schedule allocates time toward these." : timeframe === "weekly" ? "Check that your weekly routine includes blocks for these priorities." : "Track progress on these goals across the month."}`,
    });
  }

  if (timeframe === "monthly" && snapshots.length > 0) {
    const goalSnapshots = new Map<string, { first: number; last: number; label: string }>();
    for (const s of snapshots) {
      const goal = goals.find((g) => g.id === s.goalId);
      if (!goal) continue;
      if (!goalSnapshots.has(s.goalId)) {
        goalSnapshots.set(s.goalId, { first: s.denominator > 0 ? s.numerator / s.denominator : 0, last: s.denominator > 0 ? s.numerator / s.denominator : 0, label: goal.title });
      } else {
        const entry = goalSnapshots.get(s.goalId)!;
        entry.last = s.denominator > 0 ? s.numerator / s.denominator : 0;
      }
    }
    for (const [, entry] of goalSnapshots) {
      if (entry.last < entry.first && entry.last < 0.5) {
        cards.push({
          kind: "goal-alignment",
          severity: "warning",
          title: `Goal "${entry.label}" progress declined`,
          body: `Progress on "${entry.label}" dropped from ${Math.round(entry.first * 100)}% to ${Math.round(entry.last * 100)}% this month. Consider reviewing your approach or adjusting the target.`,
          actionable: true,
        });
      }
    }
  }

  const deadlineGoals = goals.filter((g: { kind: string; deadline?: string }) => g.kind === "deadline" && g.deadline);
  if (deadlineGoals.length > 0) {
    const approaching = deadlineGoals.filter((g: { deadline: string }) => {
      const daysLeft = Math.round((new Date(g.deadline).getTime() - Date.now()) / 86400000);
      return daysLeft >= 0 && daysLeft <= 7;
    });
    if (approaching.length > 0) {
      cards.push({
        kind: "goal-alignment",
        severity: "warning",
        title: `${approaching.length} deadline${approaching.length > 1 ? "s" : ""} approaching`,
        body: approaching.map((g: { title: string; deadline?: string }) => `"${g.title}" ${g.deadline ? `(due ${g.deadline})` : ""}`).join(", "),
      });
    }
  }

  return cards;
}

function timeoutLabel(tf: DigestTimeframe): string {
  if (tf === "daily") return "Today's focus: ";
  if (tf === "weekly") return "This week's priorities: ";
  return "";
}
