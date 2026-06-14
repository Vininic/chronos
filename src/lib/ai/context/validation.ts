import type { ScheduleContext } from "./ScheduleContext";

export interface ContextValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateContext(ctx: ScheduleContext): ContextValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!ctx.owner) errors.push("Context missing owner");
  if (ctx.version !== 1) errors.push("Context version must be 1");
  if (!ctx.generatedAt) errors.push("Context missing generatedAt timestamp");

  if (!Array.isArray(ctx.blocks)) errors.push("Context missing blocks array");
  if (!ctx.sleep) errors.push("Context missing sleep data");
  if (!Array.isArray(ctx.commitments)) errors.push("Context missing commitments array");
  if (!Array.isArray(ctx.goals)) errors.push("Context missing goals array");
  if (!Array.isArray(ctx.categories)) errors.push("Context missing categories array");
  if (!Array.isArray(ctx.notes)) errors.push("Context missing notes array");

  if (ctx.blocks.length > 200) warnings.push(`Large block count (${ctx.blocks.length}) may exceed token budget`);

  for (const b of ctx.blocks) {
    if (!b.id) errors.push("Block missing id");
    if (!b.title) warnings.push(`Block ${b.id} has no title`);
    if (b.durationMin <= 0) warnings.push(`Block ${b.id} has zero/negative duration`);
  }

  for (const g of ctx.goals) {
    if (!["duration", "numeric", "deadline"].includes(g.kind)) errors.push(`Goal ${g.id} has invalid kind: ${g.kind}`);
    if (g.target <= 0) warnings.push(`Goal ${g.id} has non-positive target`);
  }

  for (const c of ctx.commitments) {
    if (!["fixed", "flexible"].includes(c.commitmentType)) errors.push(`Commitment ${c.id} has invalid type`);
  }

  if (ctx.sleep.metrics.averageDurationMin < 0) errors.push("Sleep average duration is negative");
  if (ctx.sleep.metrics.averageDurationMin > 16 * 60) warnings.push("Sleep average duration exceeds 16 hours");

  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidContext(ctx: ScheduleContext): void {
  const result = validateContext(ctx);
  if (!result.valid) {
    throw new Error(`Invalid ScheduleContext: ${result.errors.join("; ")}`);
  }
}
