import type { ScheduleContext } from "../context/ScheduleContext";
import { parseMin } from "../utils/time";

export interface SchedulingViolation {
  rule: string;
  severity: "error" | "warning";
  detail: string;
}

/* ── Fixed commitments are immutable ─────────────────────── */
export function checkFixedCommitmentOverlap(
  ctx: ScheduleContext,
  proposedStart: string,
  proposedEnd: string,
  proposedCategory: string,
): SchedulingViolation | null {
  const fixedCommitments = ctx.commitments.filter((c) => c.commitmentType === "fixed");
  const propStart = parseMin(proposedStart);
  const propEnd = parseMin(proposedEnd);

  for (const c of fixedCommitments) {
    const cStart = parseMin(c.start);
    const cEnd = parseMin(c.end);
    if (propStart < cEnd && propEnd > cStart) {
      return {
        rule: "Fixed commitments are immutable",
        severity: "error",
        detail: `"${c.title}" (${c.start}-${c.end}) overlaps with proposed block`,
      };
    }
  }
  return null;
}

/* ── Sleep receives highest protection ───────────────────── */
export function checkSleepOverlap(
  ctx: ScheduleContext,
  proposedStart: string,
  proposedEnd: string,
): SchedulingViolation | null {
  const propStart = parseMin(proposedStart);
  const propEnd = parseMin(proposedEnd);

  for (const s of ctx.sleep.blocks) {
    const sStart = parseMin(s.start);
    const sEnd = parseMin(s.end);
    if (propStart < sEnd && propEnd > sStart) {
      return {
        rule: "Sleep receives highest protection",
        severity: "error",
        detail: `Proposed block overlaps with sleep (${s.start}-${s.end})`,
      };
    }
  }
  return null;
}

/* ── Goals do not override recovery ──────────────────────── */
export function checkRecoveryNotOverridden(
  ctx: ScheduleContext,
  proposedMinutes: number,
): SchedulingViolation | null {
  const currentRecovery = ctx.metrics.recoveryTimeMin;
  const totalMinutes = ctx.blocks.reduce((s, b) => s + b.durationMin, 0) + proposedMinutes;
  const recoveryRatio = (currentRecovery + proposedMinutes * 0.2) / Math.max(1, totalMinutes);

  if (recoveryRatio < 0.1 && ctx.metrics.recoveryTimeMin < 60) {
    return {
      rule: "Goals do not override recovery",
      severity: "warning",
      detail: `Adding ${proposedMinutes}min further reduces recovery ratio to ${Math.round(recoveryRatio * 100)}%`,
    };
  }
  return null;
}

/* ── Preserve category consistency ───────────────────────── */
export function checkCategoryConsistency(
  ctx: ScheduleContext,
  categoryId: string,
): SchedulingViolation | null {
  const catExists = ctx.categories.some((c) => c.id === categoryId);
  if (!catExists) {
    return {
      rule: "Preserve category consistency",
      severity: "warning",
      detail: `Category "${categoryId}" is not defined in the schedule`,
    };
  }
  return null;
}

/* ── Continue unfinished programs ────────────────────────── */
export function checkUnfinishedPrograms(ctx: ScheduleContext): SchedulingViolation[] {
  const violations: SchedulingViolation[] = [];
  for (const p of ctx.programs) {
    if (p.total > 0 && p.done < p.total && !p.lastUsed) {
      violations.push({
        rule: "Continue unfinished programs",
        severity: "warning",
        detail: `"${p.templateName}" in ${p.categoryLabel} has ${p.total - p.done} incomplete items`,
      });
    }
  }
  return violations;
}

/* ── Prioritize incomplete sessions ──────────────────────── */
export function checkIncompleteSessions(ctx: ScheduleContext): SchedulingViolation[] {
  return ctx.blocks
    .filter((b) => b.inProgress && !b.complete)
    .map((b) => ({
      rule: "Prioritize incomplete sessions",
      severity: "warning" as const,
      detail: `"${b.title}" (${b.category}) session is in progress but not completed`,
    }));
}

/* ── Minimize unnecessary changes ────────────────────────── */
export function checkChangeImpact(
  currentBlockCount: number,
  proposedBlockCount: number,
): SchedulingViolation | null {
  const changePct = Math.abs(proposedBlockCount - currentBlockCount) / Math.max(1, currentBlockCount);
  if (changePct > 0.5) {
    return {
      rule: "Minimize unnecessary changes",
      severity: "warning",
      detail: `Proposed change affects ${Math.round(changePct * 100)}% of schedule`,
    };
  }
  return null;
}

/* ── Run all scheduling rules for a proposed change ──────── */
export function validateScheduleChange(
  ctx: ScheduleContext,
  proposed: {
    start?: string;
    end?: string;
    category?: string;
    addedMinutes?: number;
    newBlockCount?: number;
  },
): SchedulingViolation[] {
  const violations: SchedulingViolation[] = [];

  if (proposed.start && proposed.end) {
    const overlap = checkFixedCommitmentOverlap(ctx, proposed.start, proposed.end, proposed.category ?? "");
    if (overlap) violations.push(overlap);

    const sleepOverlap = checkSleepOverlap(ctx, proposed.start, proposed.end);
    if (sleepOverlap) violations.push(sleepOverlap);
  }

  if (proposed.category) {
    const catIssue = checkCategoryConsistency(ctx, proposed.category);
    if (catIssue) violations.push(catIssue);
  }

  if (proposed.addedMinutes) {
    const recoveryIssue = checkRecoveryNotOverridden(ctx, proposed.addedMinutes);
    if (recoveryIssue) violations.push(recoveryIssue);
  }

  if (proposed.newBlockCount !== undefined) {
    const changeIssue = checkChangeImpact(ctx.blocks.length, proposed.newBlockCount);
    if (changeIssue) violations.push(changeIssue);
  }

  violations.push(...checkUnfinishedPrograms(ctx));
  violations.push(...checkIncompleteSessions(ctx));

  return violations;
}


