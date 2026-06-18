import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";

export function programsAnalysis(data: ScheduleData): ReportCard[] {
  const cards: ReportCard[] = [];

  const programs = data.categories.filter((c) => {
    const ws = (c as unknown as { workspace?: { structure?: { preset?: string } } }).workspace;
    return ws?.structure?.preset && ["workout", "reading", "study"].includes(ws.structure.preset);
  });

  if (programs.length === 0) return cards;

  for (const prog of programs) {
    const ws = (prog as unknown as { workspace?: { structure?: { preset?: string } } }).workspace;
    const preset = ws?.structure?.preset;
    const progBlocks = data.routine.filter((b) => b.kind === prog.id);

    if (progBlocks.length === 0) {
      cards.push({
        kind: "programs",
        severity: "insight",
        title: `"${prog.label}" program has no scheduled blocks`,
        body: `The ${preset ?? "structured"} program "${prog.label}" exists but has no blocks in today's schedule.`,
        actionable: true,
      });
    }
  }

  if (programs.length > 2) {
    cards.push({
      kind: "programs",
      severity: "warning",
      title: `${programs.length} structured programs active`,
      body: `Running ${programs.length} structured programs simultaneously may lead to overload. Consider focusing on fewer programs.`,
    });
  }

  return cards;
}
