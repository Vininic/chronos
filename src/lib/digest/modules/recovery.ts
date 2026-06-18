import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";

export function recoveryAnalysis(data: ScheduleData): ReportCard[] {
  const cards: ReportCard[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const routineCount = data.routine.filter((b) => b.kind !== "sleep").length;
  const hasSleepSchedule = data.meta.sleepSchedule && data.meta.sleepSchedule.length > 0;

  if (!hasSleepSchedule) {
    cards.push({
      kind: "recovery",
      severity: "insight",
      title: "Sleep tracking not configured",
      body: "Setting a sleep schedule helps identify recovery patterns. No sleep data is currently being tracked.",
      actionable: true,
    });
    return cards;
  }

  const overloadScore = data.ledger.compositionScore;
  if (overloadScore < 0.3) {
    cards.push({
      kind: "recovery",
      severity: "warning",
      title: "Low composition score may signal fatigue",
      body: `Your current schedule composition score is ${Math.round(overloadScore * 100)}%, which is on the lower end. When schedules are this dense, recovery may be insufficient.`,
    });
  } else if (overloadScore > 0.7) {
    cards.push({
      kind: "recovery",
      severity: "trend",
      title: "Schedule composition is healthy",
      body: `Your composition score of ${Math.round(overloadScore * 100)}% suggests a well-balanced schedule. Recovery indicators are positive.`,
    });
  }

  if (routineCount > 8) {
    cards.push({
      kind: "recovery",
      severity: "warning",
      title: "High block density may reduce recovery",
      body: `${routineCount} non-sleep blocks are scheduled. High block counts with tight transitions can increase cognitive fatigue.`,
    });
  }

  return cards;
}
