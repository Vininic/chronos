import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { durationMin } from "@/lib/schedule/types";
import { getBlocksForTimeframe, dailyAvg } from "./helpers";

export function scheduleQualityAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const blocks = getBlocksForTimeframe(data, timeframe)
    .filter((b: { kind: string }) => b.kind !== "sleep")
    .sort((a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start));

  let tightTransitions = 0;
  for (let i = 1; i < blocks.length; i++) {
    const prevEnd = (blocks[i - 1] as { end: string }).end;
    const currStart = (blocks[i] as { start: string }).start;
    const gap = durationMin(prevEnd, currStart);
    if (gap > 0 && gap < 15) tightTransitions++;
  }

  const avgTight = dailyAvg(blocks as { day: number }[], timeframe) > 0
    ? tightTransitions / Math.max(dailyAvg(blocks as { day: number }[], timeframe), 1)
    : 0;

  if (timeframe === "daily" && tightTransitions > 3) {
    cards.push({
      kind: "schedule-quality",
      severity: "warning",
      title: "Today has frequent tight transitions",
      body: `${tightTransitions} blocks have less than 15 minutes between them today. Tight transitions reduce focus and increase stress.`,
      actionable: true,
    });
  } else if (tightTransitions > 3 * Math.max(dailyAvg(blocks as { day: number }[], timeframe), 1)) {
    cards.push({
      kind: "schedule-quality",
      severity: "trend",
      title: "Frequent tight transitions across the schedule",
      body: timeframe === "weekly"
        ? `${tightTransitions} tight transitions across the week — averaging ${Math.round(avgTight)} per day. Adding 15-minute buffers between blocks can help.`
        : `${tightTransitions} blocks have tight transitions. Consider adding short buffers.`,
      actionable: true,
    });
  }

  let contextSwitches = 0;
  for (let i = 1; i < blocks.length; i++) {
    if ((blocks[i] as { kind: string }).kind !== (blocks[i - 1] as { kind: string }).kind) {
      contextSwitches++;
    }
  }
  const avgSwitches = contextSwitches / Math.max(dailyAvg(blocks as { day: number }[], timeframe), 1);

  if (avgSwitches > 4 && timeframe === "daily") {
    cards.push({
      kind: "schedule-quality",
      severity: "trend",
      title: "High number of context switches today",
      body: `${Math.round(avgSwitches)} context switches detected. Switching between different types of work more than 4 times a day can reduce overall productivity.`,
      actionable: true,
    });
  } else if (avgSwitches > 4) {
    cards.push({
      kind: "schedule-quality",
      severity: "trend",
      title: `Averaging ${Math.round(avgSwitches)} context switches per day`,
      body: `High context switching (${Math.round(avgSwitches)}/day) fragments focus. Consider batching similar activity types together.`,
      actionable: true,
    });
  }

  if (timeframe === "monthly") {
    const metrics = data.ledger.metrics;
    const scheduleMetric = metrics.find((m: { label: string }) => m.label.toLowerCase().includes("schedule"));
    if (scheduleMetric && scheduleMetric.value < 50) {
      cards.push({
        kind: "schedule-quality",
        severity: "warning",
        title: "Monthly schedule quality score is low",
        body: `Your schedule quality metric is ${scheduleMetric.value}/100. Reviewing and adjusting your schedule structure could improve long-term consistency.`,
        actionable: true,
      });
    }
  }

  const totalDaily = dailyAvg(blocks as { start: string; end: string; day: number }[], timeframe);
  const totalMinsPerDay = blocks.reduce((s: number, b: { start: string; end: string }) => s + durationMin(b.start, b.end), 0) / Math.max(dailyAvg(blocks as { day: number }[], timeframe), 1);

  if (totalMinsPerDay > 600) {
    cards.push({
      kind: "schedule-quality",
      severity: "warning",
      title: "Daily schedule exceeds productive ceiling",
      body: `Average ${Math.round(totalMinsPerDay / 60)} hours scheduled per day — above the recommended 8-10 hour productive ceiling.`,
    });
  } else if (totalMinsPerDay < 120 && totalDaily >= 2) {
    cards.push({
      kind: "schedule-quality",
      severity: "insight",
      title: "Light schedule",
      body: `Averaging ${Math.round(totalMinsPerDay / 60)} hours scheduled per day. There may be room for more focused work.`,
    });
  }

  return cards;
}
