import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe } from "./helpers";

export function burnoutAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const blocks = getBlocksForTimeframe(data, timeframe);

  const nonSleep = blocks.filter((b: { kind: string; day: number }) => b.kind !== "sleep");
  const daysWithBlocks = new Set(nonSleep.map((b: { day: number }) => b.day)).size || 1;
  const avgDaily = nonSleep.length / daysWithBlocks;

  const compositionScore = data.ledger.compositionScore;
  const hasSleepSchedule = data.meta.sleepSchedule && data.meta.sleepSchedule.length > 0;

  let riskFactors = 0;
  const signals: string[] = [];

  if (avgDaily > 10) {
    riskFactors++;
    signals.push(`averaging ${Math.round(avgDaily)} blocks/day`);
  }

  if (compositionScore < 0.25) {
    riskFactors++;
    signals.push("low composition score");
  }

  if (!hasSleepSchedule) {
    riskFactors++;
    signals.push("no sleep tracking");
  }

  if (timeframe === "monthly") {
    const snapshots = data.progressSnapshots;
    if (snapshots.length > 3) {
      const sorted = [...snapshots].sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
      const midIdx = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, midIdx);
      const secondHalf = sorted.slice(midIdx);
      const firstAvg = firstHalf.reduce((s: number, snap: { numerator: number; denominator: number }) => s + (snap.denominator > 0 ? snap.numerator / snap.denominator : 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s: number, snap: { numerator: number; denominator: number }) => s + (snap.denominator > 0 ? snap.numerator / snap.denominator : 0), 0) / secondHalf.length;
      if (secondAvg < firstAvg - 0.15) {
        riskFactors++;
        signals.push("declining completion rate");
      }
    }
  }

  if (riskFactors >= 2) {
    cards.push({
      kind: "burnout",
      severity: "warning",
      title: "Potential burnout risk detected",
      body: `${riskFactors} risk factor${riskFactors > 1 ? "s" : ""} identified: ${signals.join(", ")}. ${timeframe === "monthly" ? "These patterns sustained over time increase burnout probability." : "Reviewing workload balance could help prevent long-term fatigue."}`,
      actionable: true,
    });
  } else if (riskFactors === 0) {
    cards.push({
      kind: "burnout",
      severity: "trend",
      title: "Burnout indicators are low",
      body: "No significant burnout risk factors detected. Current workload appears sustainable.",
    });
  }

  return cards;
}
