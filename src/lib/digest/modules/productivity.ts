import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe } from "./helpers";

export function productivityAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const todayBlocks = getBlocksForTimeframe(data, timeframe).filter((b: { kind: string }) => b.kind !== "sleep");
  const morningBlocks = todayBlocks.filter((b) => {
    const h = parseInt(b.start.split(":")[0], 10);
    return h >= 5 && h < 12;
  });
  const afternoonBlocks = todayBlocks.filter((b) => {
    const h = parseInt(b.start.split(":")[0], 10);
    return h >= 12 && h < 18;
  });
  const eveningBlocks = todayBlocks.filter((b) => {
    const h = parseInt(b.start.split(":")[0], 10);
    return h >= 18;
  });

  if (morningBlocks.length > afternoonBlocks.length && morningBlocks.length > eveningBlocks.length) {
    cards.push({
      kind: "productivity",
      severity: "insight",
      title: "Most productive hours in the morning",
      body: `The majority of your blocks (${morningBlocks.length}) are scheduled before noon. Morning-oriented schedules typically have higher completion rates.`,
    });
  } else if (eveningBlocks.length > morningBlocks.length) {
    cards.push({
      kind: "productivity",
      severity: "trend",
      title: "Most blocks scheduled in the evening",
      body: `${eveningBlocks.length} blocks are scheduled after 6 PM. Evening hours often have lower completion rates due to accumulated fatigue.`,
    });
  }

  const deepBlocks = todayBlocks.filter((b) => b.kind === "deep");
  if (deepBlocks.length > 0) {
    const deepAfterNoon = deepBlocks.filter((b) => {
      const h = parseInt(b.start.split(":")[0], 10);
      return h >= 12;
    });
    if (deepAfterNoon.length > 0) {
      cards.push({
        kind: "productivity",
        severity: "opportunity",
        title: "Deep work placed in suboptimal hours",
        body: `${deepAfterNoon.length} deep work session${deepAfterNoon.length > 1 ? "s are" : " is"} scheduled after noon. Deep concentration typically peaks in late morning for most people.`,
        actionable: true,
      });
    }
  }

  return cards;
}
