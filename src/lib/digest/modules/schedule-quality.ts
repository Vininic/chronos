import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { durationMin } from "@/lib/schedule/types";
import { getBlocksForTimeframe } from "./helpers";

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

  if (tightTransitions > 2) {
    cards.push({
      kind: "schedule-quality",
      severity: "warning",
      title: timeframe === "daily"
        ? "Today has frequent tight transitions"
        : "Frequent tight transitions detected",
      body: timeframe === "weekly"
        ? `${tightTransitions} tight transitions across the week. Consider adding 15-minute buffers between consecutive blocks to reduce cognitive load.`
        : `${tightTransitions} blocks have less than 15 minutes between them. Tight transitions reduce focus and increase stress.`,
      actionable: true,
    });
  }

  let contextSwitches = 0;
  for (let i = 1; i < blocks.length; i++) {
    if ((blocks[i] as { kind: string }).kind !== (blocks[i - 1] as { kind: string }).kind) {
      contextSwitches++;
    }
  }

  if (timeframe === "weekly" && contextSwitches > 20) {
    cards.push({
      kind: "schedule-quality",
      severity: "trend",
      title: "High weekly context switch count",
      body: `${contextSwitches} context switches detected across the week. Frequent task switching reduces overall productivity by up to 40%. Consider batching similar activities.`,
      actionable: true,
    });
  } else if (contextSwitches > 4 && timeframe !== "weekly") {
    cards.push({
      kind: "schedule-quality",
      severity: "trend",
      title: "High number of context switches",
      body: `${contextSwitches} context switches detected. Switching between different types of work more than 4 times a day can reduce overall productivity by up to 40%.`,
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

  const totalScheduled = blocks.reduce((s: number, b: { start: string; end: string }) => s + durationMin(b.start, b.end), 0);
  if (totalScheduled > 600) {
    cards.push({
      kind: "schedule-quality",
      severity: "warning",
      title: timeframe === "daily" ? "Today is overloaded" : "Schedule may be overloaded",
      body: timeframe === "weekly"
        ? `Total scheduled time this week is ${Math.round(totalScheduled / 60)} hours across all days.`
        : `Total scheduled time is ${Math.round(totalScheduled / 60)} hours, which exceeds the recommended 8-10 hour productive ceiling.`,
    });
  }

  return cards;
}
