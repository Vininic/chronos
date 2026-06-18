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

  if (tightTransitions > 0) {
    const daysCount = Math.max(dailyAvg(blocks as { day: number }[], timeframe), 1);
    const perDay = tightTransitions / daysCount;
    cards.push({
      kind: "schedule-quality",
      severity: "insight",
      title: `${tightTransitions} tight transition${tightTransitions > 1 ? "s" : ""} ${timeframe === "daily" ? "today" : timeframe === "weekly" ? "this week" : "detected"}`,
      body: perDay > 2
        ? `Averaging ${Math.round(perDay)} per day — blocks with less than 15 minutes between them.`
        : `${tightTransitions} block${tightTransitions > 1 ? "s" : ""} start within 15 minutes of the previous block's end.`,
    });
  }

  let contextSwitches = 0;
  for (let i = 1; i < blocks.length; i++) {
    if ((blocks[i] as { kind: string }).kind !== (blocks[i - 1] as { kind: string }).kind) {
      contextSwitches++;
    }
  }

  if (contextSwitches > 0) {
    const daysCount = Math.max(dailyAvg(blocks as { day: number }[], timeframe), 1);
    const perDay = Math.round(contextSwitches / daysCount);
    cards.push({
      kind: "schedule-quality",
      severity: "insight",
      title: `${contextSwitches} context switch${contextSwitches > 1 ? "es" : ""} ${timeframe === "daily" ? "today" : timeframe === "weekly" ? "this week" : "detected"}`,
      body: perDay > 0
        ? `Averaging ${perDay} per day — transitions between different block types.`
        : `${contextSwitches} change${contextSwitches > 1 ? "s" : ""} between block types.`,
    });
  }

  const totalMinsPerDay = blocks.reduce((s: number, b: { start: string; end: string }) => s + durationMin(b.start, b.end), 0) / Math.max(dailyAvg(blocks as { day: number }[], timeframe), 1);

  cards.push({
    kind: "schedule-quality",
    severity: "insight",
    title: `Averaging ${Math.round(totalMinsPerDay / 60)}h scheduled per day`,
    body: `${blocks.length} non-sleep block${blocks.length > 1 ? "s" : ""} across ${dailyAvg(blocks as { day: number }[], timeframe) > 0 ? Math.round(dailyAvg(blocks as { day: number }[], timeframe)) + " day(s)" : "the schedule"}.`,
  });

  if (timeframe === "monthly") {
    const metrics = data.ledger.metrics;
    const scheduleMetric = metrics.find((m: { label: string }) => m.label.toLowerCase().includes("schedule"));
    if (scheduleMetric) {
      cards.push({
        kind: "schedule-quality",
        severity: "insight",
        title: `Schedule quality metric: ${scheduleMetric.value}/100`,
        body: `Based on ledger tracking for this month.`,
      });
    }
  }

  return cards;
}
