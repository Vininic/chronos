import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { durationMin } from "@/lib/schedule/types";
import { getBlocksForTimeframe } from "./helpers";

export function scheduleQualityAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const todayBlocks = getBlocksForTimeframe(data, timeframe)
    .filter((b: { kind: string }) => b.kind !== "sleep")
    .sort((a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start));

  let tightTransitions = 0;
  for (let i = 1; i < todayBlocks.length; i++) {
    const prevEnd = todayBlocks[i - 1].end;
    const currStart = todayBlocks[i].start;
    const gap = durationMin(prevEnd, currStart);
    if (gap > 0 && gap < 15) {
      tightTransitions++;
    }
  }

  if (tightTransitions > 2) {
    cards.push({
      kind: "schedule-quality",
      severity: "warning",
      title: "Frequent tight transitions",
      body: `${tightTransitions} blocks have less than 15 minutes between them. Tight transitions reduce focus and increase stress.`,
      actionable: true,
    });
  }

  let contextSwitches = 0;
  for (let i = 1; i < todayBlocks.length; i++) {
    if (todayBlocks[i].kind !== todayBlocks[i - 1].kind) {
      contextSwitches++;
    }
  }

  if (contextSwitches > 4) {
    cards.push({
      kind: "schedule-quality",
      severity: "trend",
      title: "High number of context switches",
      body: `${contextSwitches} context switches detected. Switching between different types of work more than 4 times a day can reduce overall productivity by up to 40%.`,
      actionable: true,
    });
  }

  const totalScheduled = todayBlocks.reduce((s, b) => s + durationMin(b.start, b.end), 0);
  if (totalScheduled > 600) {
    cards.push({
      kind: "schedule-quality",
      severity: "warning",
      title: "Schedule may be overloaded",
      body: `Total scheduled time is ${Math.round(totalScheduled / 60)} hours, which exceeds the recommended 8-10 hour productive ceiling.`,
    });
  }

  return cards;
}
