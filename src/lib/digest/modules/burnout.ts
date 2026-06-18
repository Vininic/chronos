import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe } from "./helpers";

export function burnoutAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const blocks = getBlocksForTimeframe(data, timeframe);

  const blockCount = blocks.filter((b: { kind: string }) => b.kind !== "sleep").length;
  const compositionScore = data.ledger.compositionScore;
  const hasSleepSchedule = data.meta.sleepSchedule && data.meta.sleepSchedule.length > 0;

  let riskFactors = 0;
  const signals: string[] = [];

  if (blockCount > 10) {
    riskFactors++;
    signals.push(`high block count (${blockCount})`);
  }

  if (compositionScore < 0.25) {
    riskFactors++;
    signals.push("low composition score");
  }

  if (!hasSleepSchedule) {
    riskFactors++;
    signals.push("no sleep tracking");
  }

  if (riskFactors >= 2) {
    cards.push({
      kind: "burnout",
      severity: "warning",
      title: "Potential burnout risk detected",
      body: `${riskFactors} risk factor${riskFactors > 1 ? "s" : ""} identified: ${signals.join(", ")}. Dense schedules without adequate recovery increase burnout probability.`,
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
