import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";

export function opportunityAnalysis(data: ScheduleData): ReportCard[] {
  const cards: ReportCard[] = [];

  const todayBlocks = data.routine.filter((b) => b.kind !== "sleep").sort((a, b) => a.start.localeCompare(b.start));
  const deepBlocks = todayBlocks.filter((b) => b.kind === "deep");

  if (deepBlocks.length > 0) {
    const deepMornings = deepBlocks.filter((b) => {
      const h = parseInt(b.start.split(":")[0], 10);
      return h < 12;
    });
    const deepRatio = deepMornings.length / deepBlocks.length;

    if (deepRatio < 0.5) {
      cards.push({
        kind: "opportunity",
        severity: "opportunity",
        title: "Move deep work earlier for higher impact",
        body: `${Math.round((1 - deepRatio) * 100)}% of deep work sessions are scheduled after noon. Moving them before lunch could significantly improve output quality.`,
        actionable: true,
      });
    }
  }

  const gapBlocks = todayBlocks.filter((b) => b.kind === "shallow" || b.kind === "meeting");
  if (gapBlocks.length > 3) {
    cards.push({
      kind: "opportunity",
      severity: "opportunity",
      title: "Consolidate shallow work into blocks",
      body: `${gapBlocks.length} shallow/meeting blocks are scattered throughout the day. Batching them could free up 2-3 uninterrupted deep work hours.`,
      actionable: true,
    });
  }

  return cards;
}
