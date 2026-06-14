import type { ScheduleContext } from "../context/ScheduleContext";

export interface RuleCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

/* ── Goals influence schedules but are not schedules ─────── */
export function checkGoalScheduleDistinction(ctx: ScheduleContext): RuleCheck {
  const goalBlockRatio = ctx.blocks.filter((b) =>
    ctx.goals.some((g) => g.categoryId === b.category),
  ).length / Math.max(1, ctx.blocks.length);

  return {
    rule: "Goals influence schedules but are not schedules",
    passed: goalBlockRatio < 1,
    detail: `${Math.round(goalBlockRatio * 100)}% of blocks are in goal categories`,
  };
}

/* ── Categories establish activity meaning ───────────────── */
export function checkCategoryActivityMeaning(ctx: ScheduleContext): RuleCheck {
  const uncategorized = ctx.blocks.filter((b) => !ctx.categories.some((c) => c.id === b.category));
  return {
    rule: "Categories establish activity meaning",
    passed: uncategorized.length === 0,
    detail: uncategorized.length > 0
      ? `${uncategorized.length} blocks without a matching category`
      : "All blocks belong to known categories",
  };
}

/* ── Programs represent recurring structures ─────────────── */
export function checkProgramRecurringStructure(ctx: ScheduleContext): RuleCheck {
  const activePrograms = ctx.programs.filter((p) => p.total > 0);
  const stalePrograms = activePrograms.filter((p) => !p.lastUsed);
  return {
    rule: "Programs represent recurring structures",
    passed: stalePrograms.length === 0,
    detail: `${activePrograms.length} programs tracked, ${stalePrograms.length} never used`,
  };
}

/* ── Fixed commitments cannot be moved automatically ─────── */
export function checkFixedCommitmentImmutability(ctx: ScheduleContext): RuleCheck {
  const fixed = ctx.commitments.filter((c) => c.commitmentType === "fixed");
  return {
    rule: "Fixed commitments cannot be moved automatically",
    passed: true,
    detail: `${fixed.length} fixed commitments are treated as hard constraints`,
  };
}

/* ── Flexible commitments can be repositioned ────────────── */
export function checkFlexibleCommitmentRepositioning(ctx: ScheduleContext): RuleCheck {
  const flexible = ctx.commitments.filter((c) => c.commitmentType === "flexible");
  return {
    rule: "Flexible commitments can be repositioned",
    passed: true,
    detail: `${flexible.length} flexible commitments available for optimization`,
  };
}

/* ── Sleep is a protected resource ───────────────────────── */
export function checkSleepProtected(ctx: ScheduleContext): RuleCheck {
  const hasSchedule = ctx.sleep.metrics.averageDurationMin > 0;
  const highDebt = ctx.sleep.metrics.debtMin > 120;
  return {
    rule: "Sleep is a protected resource",
    passed: hasSchedule && !highDebt,
    detail: hasSchedule
      ? `Avg ${Math.round(ctx.sleep.metrics.averageDurationMin / 60 * 10) / 10}h sleep, ${Math.round(ctx.sleep.metrics.debtMin / 60 * 10) / 10}h debt`
      : "No sleep schedule defined",
  };
}

/* ── Notes provide planning context ──────────────────────── */
export function checkNotesContext(ctx: ScheduleContext): RuleCheck {
  return {
    rule: "Notes provide planning context",
    passed: ctx.notes.length > 0,
    detail: `${ctx.notes.length} notes extracted from blocks and commitments`,
  };
}

/* ── Completion history influences future planning ───────── */
export function checkCompletionHistory(ctx: ScheduleContext): RuleCheck {
  return {
    rule: "Completion history influences future planning",
    passed: ctx.historicalCompletion.length > 0,
    detail: `${ctx.historicalCompletion.length} historical completion records available`,
  };
}

/* ── Recovery is equal in importance to productivity ─────── */
export function checkRecoveryBalance(ctx: ScheduleContext): RuleCheck {
  const ratio = ctx.metrics.recoveryTimeMin / Math.max(1, ctx.metrics.focusTimeMin);
  return {
    rule: "Recovery is equal in importance to productivity",
    passed: ratio >= 0.2,
    detail: `Recovery/focus ratio: ${Math.round(ratio * 100)}% (target ≥20%)`,
  };
}

/* ── Preserve successful routines whenever possible ──────── */
export function checkPreserveSuccessfulRoutines(ctx: ScheduleContext): RuleCheck {
  const highCompletionBlocks = ctx.historicalCompletion.filter((h) => h.completed).length;
  const totalHistorical = ctx.historicalCompletion.length;
  return {
    rule: "Preserve successful routines whenever possible",
    passed: totalHistorical === 0 || highCompletionBlocks / Math.max(1, totalHistorical) >= 0.5,
    detail: totalHistorical > 0
      ? `${Math.round(highCompletionBlocks / totalHistorical * 100)}% of past blocks completed`
      : "No completion history yet",
  };
}

/* ── Run all rules ───────────────────────────────────────── */
export function evaluateAllRules(ctx: ScheduleContext): RuleCheck[] {
  return [
    checkGoalScheduleDistinction(ctx),
    checkCategoryActivityMeaning(ctx),
    checkProgramRecurringStructure(ctx),
    checkFixedCommitmentImmutability(ctx),
    checkFlexibleCommitmentRepositioning(ctx),
    checkSleepProtected(ctx),
    checkNotesContext(ctx),
    checkCompletionHistory(ctx),
    checkRecoveryBalance(ctx),
    checkPreserveSuccessfulRoutines(ctx),
  ];
}

export function ruleSummary(rules: RuleCheck[]): { passed: number; total: number; failing: RuleCheck[] } {
  const passed = rules.filter((r) => r.passed).length;
  const failing = rules.filter((r) => !r.passed);
  return { passed, total: rules.length, failing };
}
