import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe, getTodayBlocks } from "./helpers";

export function recoveryAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const blocks = getBlocksForTimeframe(data, timeframe);
  const nonSleep = blocks.filter((b: { kind: string }) => b.kind !== "sleep");
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

  const score = data.ledger.compositionScore;

  if (timeframe === "daily") {
    const todayBlocks = getTodayBlocks(data).filter((b: { kind: string }) => b.kind !== "sleep");
    const label = todayBlocks.length === 0 ? "No non-sleep blocks scheduled for today" : `${todayBlocks.length} blocks scheduled today`;
    cards.push({
      kind: "recovery",
      severity: "insight",
      title: `Today's recovery outlook: ${label}`,
      body: todayBlocks.length > 6
        ? `With ${todayBlocks.length} blocks today, recovery windows are limited. Consider reviewing block density.`
        : `Today's schedule has ${todayBlocks.length} blocks, which allows for adequate recovery between activities.`,
    });
  }

  if (timeframe === "monthly") {
    const snapshots = data.progressSnapshots;
    if (snapshots.length > 3) {
      const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const firstRatio = first.denominator > 0 ? first.numerator / first.denominator : 0;
      const lastRatio = last.denominator > 0 ? last.numerator / last.denominator : 0;
      if (lastRatio < firstRatio) {
        cards.push({
          kind: "recovery",
          severity: "warning",
          title: "Goal completion rate declining over the month",
          body: `Completion ratio dropped from ${Math.round(firstRatio * 100)}% to ${Math.round(lastRatio * 100)}%. This may indicate accumulated fatigue or unsustainable workload.`,
          actionable: true,
        });
      }
    }
  }

  if (score < 0.3) {
    cards.push({
      kind: "recovery",
      severity: "warning",
      title: timeframe === "daily" ? "Today's schedule is densely packed" : "Low composition score may signal fatigue",
      body: `Your schedule composition score is ${Math.round(score * 100)}%. ${score < 0.2 ? "This is critically low — consider reducing block count." : "When schedules are this dense, recovery may be insufficient."}`,
    });
  } else if (score > 0.7) {
    cards.push({
      kind: "recovery",
      severity: "trend",
      title: timeframe === "daily" ? "Today's schedule looks well-balanced" : "Schedule composition is healthy",
      body: `Your composition score of ${Math.round(score * 100)}% suggests a well-balanced schedule. Recovery indicators are positive across ${timeframe === "weekly" ? "the week" : "this period"}.`,
    });
  }

  if (nonSleep.length > 8) {
    cards.push({
      kind: "recovery",
      severity: "warning",
      title: timeframe === "weekly" ? "Weekly block count is high" : "High block density may reduce recovery",
      body: `${nonSleep.length} non-sleep blocks are scheduled. ${timeframe === "weekly" ? "Across the full week, this averages " + Math.round(nonSleep.length / 7) + " blocks per day." : "High block counts with tight transitions can increase cognitive fatigue."}`,
    });
  }

  return cards;
}