import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard, DigestTimeframe } from "../types";
import { getBlocksForTimeframe } from "./helpers";

export function programsAnalysis(data: ScheduleData, timeframe: DigestTimeframe): ReportCard[] {
  const cards: ReportCard[] = [];
  const blocks = getBlocksForTimeframe(data, timeframe);

  const programs = data.categories.filter((c: { workspace?: { structure?: { preset?: string } } }) => {
    const ws = (c as { workspace?: { structure?: { preset?: string } } }).workspace;
    return ws?.structure?.preset && ["workout", "reading", "study"].includes(ws.structure.preset);
  });

  if (programs.length === 0) return cards;

  for (const prog of programs) {
    const ws = (prog as { workspace?: { structure?: { preset?: string } } }).workspace;
    const preset = ws?.structure?.preset;
    const progBlocks = blocks.filter((b: { kind: string }) => b.kind === prog.id);

    if (progBlocks.length === 0) {
      cards.push({
        kind: "programs",
        severity: "insight",
        title: timeoutLabel(timeframe) + `"${(prog as { label: string }).label}" has no scheduled blocks`,
        body: `The ${preset ?? "structured"} program "${(prog as { label: string }).label}" exists but has no blocks in ${timeframe === "daily" ? "today's" : "the current"} schedule.`,
        actionable: true,
      });
    }
  }

  if (programs.length > 2) {
    cards.push({
      kind: "programs",
      severity: "warning",
      title: `${programs.length} structured programs active`,
      body: `Running ${programs.length} structured programs simultaneously may lead to overload. Consider focusing on fewer programs ${timeframe === "monthly" ? "over the coming month" : "for better adherence"}.`,
    });
  }

  if (timeframe === "monthly") {
    const scheduledBlocks = blocks.filter((b: { kind: string }) => programs.some((p: { id: string }) => p.id === b.kind));
    if (scheduledBlocks.length > 20) {
      cards.push({
        kind: "programs",
        severity: "insight",
        title: "High program engagement this month",
        body: `${scheduledBlocks.length} program-specific blocks scheduled this month. Consistent program engagement is a strong indicator of structured progress.`,
      });
    }
  }

  return cards;
}

function timeoutLabel(tf: DigestTimeframe): string {
  return tf === "daily" ? "Today: " : tf === "weekly" ? "This week: " : "";
}
