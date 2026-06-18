import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe, dailyAvg } from "./helpers";

export function recoveryAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const blocks = getBlocksForTimeframe(data, timeframe);
  const nonSleep = blocks.filter((b: { kind: string; day: number }) => b.kind !== "sleep");
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

  const avgDailyBlocks = dailyAvg(nonSleep, timeframe);
  const score = data.ledger.compositionScore;

  if (timeframe === "daily") {
    const todayBlocks = nonSleep;
    if (todayBlocks.length > 10) {
      cards.push({
        kind: "recovery",
        severity: "insight",
        title: "Today is densely packed",
        body: `${todayBlocks.length} non-sleep blocks today. Consider whether all are essential or if some can be moved.`,
      });
    } else if (todayBlocks.length > 0) {
      cards.push({
        kind: "recovery",
        severity: "insight",
        title: `Today has ${todayBlocks.length} blocks scheduled`,
        body: todayBlocks.length <= 6
          ? "Today's schedule has room for adequate recovery between activities."
          : "Today is moderately busy. Recovery windows should be respected.",
      });
    }
  }

  if (avgDailyBlocks > 10) {
    cards.push({
      kind: "recovery",
      severity: "warning",
      title: timeframe === "weekly"
        ? `Averaging ${Math.round(avgDailyBlocks)} blocks per day this week`
        : timeframe === "monthly"
        ? `Averaging ${Math.round(avgDailyBlocks)} blocks per day this month`
        : "Above-average block density",
      body: `You average ${Math.round(avgDailyBlocks)} non-sleep blocks per day. Schedules with more than 10 daily blocks tend to reduce recovery windows.`,
      actionable: true,
    });
  } else if (avgDailyBlocks <= 6 && avgDailyBlocks > 0) {
    cards.push({
      kind: "recovery",
      severity: "trend",
      title: timeframe === "daily" ? "Today's schedule leaves room for recovery" : "Block density is sustainable",
      body: avgDailyBlocks > 0
        ? `Averaging ${Math.round(avgDailyBlocks)} non-sleep blocks per day — well within a sustainable range.`
        : timeLabel(timeframe) + " schedule leaves room for recovery.",
    });
  }

  if (score < 0.3) {
    cards.push({
      kind: "recovery",
      severity: "warning",
      title: "Low composition score may signal fatigue",
      body: `Your schedule composition score is ${Math.round(score * 100)}%. ${score < 0.2 ? "This is critically low — consider reviewing schedule density." : "When schedules are this dense, recovery may be insufficient."}`,
    });
  } else if (score > 0.7) {
    cards.push({
      kind: "recovery",
      severity: "trend",
      title: "Schedule composition is healthy",
      body: `Your composition score of ${Math.round(score * 100)}% suggests a well-balanced schedule. Recovery indicators are positive.`,
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
      if (lastRatio < firstRatio - 0.1) {
        cards.push({
          kind: "recovery",
          severity: "warning",
          title: "Goal completion rate declining over the month",
          body: `Completion ratio dropped from ${Math.round(firstRatio * 100)}% to ${Math.round(lastRatio * 100)}%. This may signal accumulated fatigue.`,
          actionable: true,
        });
      }
    }
  }

  return cards;
}

function timeLabel(tf: DigestTimeframe): string {
  return tf === "daily" ? "Today's" : tf === "weekly" ? "This week's" : "Current";
}