import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe } from "./helpers";

export function opportunityAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];

  const blocks = getBlocksForTimeframe(data, timeframe)
    .filter((b: { kind: string }) => b.kind !== "sleep")
    .sort((a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start));

  const deepBlocks = blocks.filter((b: { kind: string }) => b.kind === "deep");

  if (deepBlocks.length > 0) {
    const deepMornings = deepBlocks.filter((b: { start: string }) => {
      const h = parseInt(b.start.split(":")[0], 10);
      return h < 12;
    });
    const deepRatio = deepMornings.length / deepBlocks.length;

    if (deepRatio < 0.5) {
      cards.push({
        kind: "opportunity",
        severity: "opportunity",
        title: timeframe === "weekly"
          ? "Consider redistributing deep work across the week"
          : "Move deep work earlier for higher impact",
        body: timeframe === "weekly"
          ? `${Math.round((1 - deepRatio) * 100)}% of weekly deep work sessions are after noon. Try to schedule more deep blocks in the morning for higher cognitive performance.`
          : `${Math.round((1 - deepRatio) * 100)}% of deep work sessions are scheduled after noon. Moving them before lunch could significantly improve output quality.`,
        actionable: true,
      });
    }
  }

  const gapBlocks = blocks.filter((b: { kind: string }) => b.kind === "shallow" || b.kind === "meeting");
  if (gapBlocks.length > 3) {
    cards.push({
      kind: "opportunity",
      severity: "opportunity",
      title: timeframe === "weekly"
        ? "Batch shallow work across the week"
        : timeframe === "monthly"
        ? "Monthly shallow work consolidation opportunity"
        : "Consolidate shallow work into blocks",
      body: timeframe === "weekly"
        ? `${gapBlocks.length} shallow/meeting blocks are scattered across the week. Batching them on fewer days could free up uninterrupted deep work time.`
        : `${gapBlocks.length} shallow/meeting blocks are scattered throughout. Batching them could free up 2-3 uninterrupted deep work hours.`,
      actionable: true,
    });
  }

  if (timeframe === "monthly") {
    const scheduledHours = data.ledger.scheduledHours;
    if (scheduledHours.length > 1) {
      const variance = scheduledHours.reduce((max: number, h: number) => Math.max(max, h), 0) - scheduledHours.reduce((min: number, h: number) => Math.min(min, h), 0);
      if (variance > 4) {
        cards.push({
          kind: "opportunity",
          severity: "opportunity",
          title: "High day-to-day workload variance",
          body: `Daily scheduled hours vary by ${Math.round(variance)} hours across the month. More consistent daily workloads reduce stress and improve predictability.`,
          actionable: true,
        });
      }
    }
    const goalsWithDeadlines = data.goals.filter((g: { kind: string; deadline?: string }) => g.kind === "deadline" && g.deadline);
    const thisMonth = goalsWithDeadlines.filter((g: { deadline: string }) => g.deadline!.startsWith(new Date().toISOString().slice(0, 7)));
    if (thisMonth.length > 0) {
      cards.push({
        kind: "opportunity",
        severity: "insight",
        title: `${thisMonth.length} deadline${thisMonth.length > 1 ? "s" : ""} due this month`,
        body: `You have ${thisMonth.length} goal deadline${thisMonth.length > 1 ? "s" : ""} falling this month. Ensure your schedule allocates sufficient time to meet them.`,
      });
    }
  }

  return cards;
}
