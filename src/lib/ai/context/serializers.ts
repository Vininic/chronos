import type { ScheduleContext, AiBlock, AiGoal, AiCommitment, AiCategory, AiNote } from "./ScheduleContext";

export interface CompressedContext {
  owner: string;
  cycle: string;
  blocks: string;
  sleep: string;
  commitments: string;
  goals: string;
  categories: string;
  programs: string;
  notes: string;
  metrics: string;
  focus: string;
  autonomy: string;
}

function compressBlock(b: AiBlock): string {
  const p = b.hasProgram ? `${b.programName ?? "?"} ${b.programProgress.done}/${b.programProgress.total}` : "";
  const s = b.complete ? "[x]" : b.inProgress ? "[>]" : "[ ]";
  const f = b.isFocus ? " «focus»" : "";
  return `${s} ${b.start}-${b.end} ${b.durationMin}min ${b.category} "${b.title}"${p ? ` {${p}}` : ""}${f}`;
}

function compressGoal(g: AiGoal): string {
  const pct = Math.round(g.progress * 100);
  const deadline = g.daysRemaining !== undefined ? ` ${g.daysRemaining}d left` : "";
  return `${g.title} (${g.kind} ${pct}%${deadline})`;
}

function compressCommitment(c: AiCommitment): string {
  return `[${c.done ? "x" : " "}] ${c.date ?? ""} ${c.start}-${c.end} "${c.title}" ${c.commitmentType}`;
}

function compressCategory(c: AiCategory): string {
  return `${c.label} (${c.weeklyBlockCount}wk ${c.programCount}prog)`;
}

function compressNote(n: AiNote): string {
  return `${n.date} ${n.category} "${n.sourceTitle}": ${n.text.slice(0, 120)}`;
}

export function compressContext(ctx: ScheduleContext): CompressedContext {
  const focusBlocks = ctx.blocks.filter((b) => b.isFocus);
  const focusMin = focusBlocks.reduce((s, b) => s + b.durationMin, 0);
  const focusDone = focusBlocks.filter((b) => b.complete).length;
  return {
    owner: ctx.owner,
    cycle: `${ctx.cycle.name} #${ctx.cycle.number} w${ctx.cycle.week}`,
    blocks: ctx.blocks.map(compressBlock).join("\n"),
    sleep: `avg ${Math.round(ctx.sleep.metrics.averageDurationMin / 60 * 10) / 10}h debt ${Math.round(ctx.sleep.metrics.debtMin / 60 * 10) / 10}h`,
    commitments: ctx.commitments.map(compressCommitment).join("\n"),
    goals: ctx.goals.map(compressGoal).join("\n"),
    categories: ctx.categories.map(compressCategory).join("\n"),
    programs: ctx.programs.map((p) => `${p.categoryLabel} / ${p.templateName} ${p.done}/${p.total}`).join("\n"),
    notes: ctx.notes.map(compressNote).join("\n"),
    metrics: `focus ${Math.round(ctx.metrics.focusTimeMin / 60 * 10) / 10}h recovery ${Math.round(ctx.metrics.recoveryTimeMin / 60 * 10) / 10}h overload ${Math.round(ctx.metrics.overloadScore * 100)}%`,
    focus: focusBlocks.length
      ? `${focusBlocks.length} focus blocks · ${Math.round(focusMin / 60 * 10) / 10}h · ${focusDone}/${focusBlocks.length} complete — these are the user's declared priority. Weight focus-block protection, timing and completion above other categories in your analysis and suggestions.`
      : "No focus categories set — suggest the user designate one to anchor their deep work.",
    autonomy: ctx.autonomy,
  };
}

export function compressedTokenEstimate(compressed: CompressedContext): number {
  let total = 0;
  for (const val of Object.values(compressed)) {
    total += val.length / 4;
  }
  return Math.round(total);
}
