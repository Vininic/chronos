import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";
import type { DigestContext } from "./helpers";
import { categoryLabel } from "./helpers";

interface PresetCategory {
  id: string;
  label: string;
  workspace?: { structure?: { preset?: string } };
}

export function programsAnalysis(data: ScheduleData, ctx: DigestContext): ReportCard[] {
  const cards: ReportCard[] = [];

  const programs = (data.categories as PresetCategory[]).filter((c) => {
    const preset = c.workspace?.structure?.preset;
    return preset && ["workout", "reading", "study"].includes(preset);
  });
  if (programs.length === 0) return cards;

  const scopeWord = ctx.timeframe === "daily" ? "today" : ctx.timeframe === "weekly" ? "this week" : "in this period";

  // Count instances per program across the real date range (routine + commitments).
  const countByKind = new Map<string, number>();
  for (const b of ctx.blocks) countByKind.set(b.kind, (countByKind.get(b.kind) ?? 0) + 1);

  for (const prog of programs) {
    const count = countByKind.get(prog.id) ?? 0;
    const preset = prog.workspace?.structure?.preset ?? "structured";
    if (count === 0) {
      cards.push({
        kind: "programs",
        severity: "insight",
        title: `"${categoryLabel(data, prog.id)}" has no sessions ${scopeWord}`,
        body: `The ${preset} program exists but nothing is scheduled ${scopeWord} — including one-off commitments.`,
        actionable: true,
      });
    } else if (ctx.dayCount > 1) {
      cards.push({
        kind: "programs",
        severity: "trend",
        title: `${count} "${categoryLabel(data, prog.id)}" session${count > 1 ? "s" : ""} ${scopeWord}`,
        body: `The ${preset} program is scheduled ${count} time${count > 1 ? "s" : ""} ${scopeWord}.`,
      });
    }
  }

  if (programs.length > 2) {
    cards.push({
      kind: "programs",
      severity: "insight",
      title: `${programs.length} structured programs active`,
      body: `${programs.length} categories have workspace presets configured.`,
    });
  }

  return cards;
}
