import type { ScheduleContext } from "./ScheduleContext";

export function inspectContext(ctx: ScheduleContext): Record<string, unknown> {
  return {
    version: ctx.version,
    generatedAt: ctx.generatedAt,
    owner: ctx.owner,
    cycle: ctx.cycle,
    blockCount: ctx.blocks.length,
    categoryCount: ctx.categories.length,
    goalCount: ctx.goals.length,
    commitmentCount: ctx.commitments.length,
    programCount: ctx.programs.length,
    noteCount: ctx.notes.length,
    dailyStatDays: ctx.dailyStats.length,
    weeklyStatWeeks: ctx.weeklyStats.length,
    historicalEntryCount: ctx.historicalCompletion.length,
    sleepAvgHours: Math.round(ctx.sleep.metrics.averageDurationMin / 60 * 10) / 10,
    focusHours: Math.round(ctx.metrics.focusTimeMin / 60 * 10) / 10,
    recoveryHours: Math.round(ctx.metrics.recoveryTimeMin / 60 * 10) / 10,
    overloadPct: Math.round(ctx.metrics.overloadScore * 100),
    autonomy: ctx.autonomy,
  };
}

export function contextSizeBytes(ctx: ScheduleContext): number {
  return new TextEncoder().encode(JSON.stringify(ctx)).length;
}

export function estimatedTokenCount(ctx: ScheduleContext): number {
  return Math.round(contextSizeBytes(ctx) / 4);
}

export function summarizeContextHealth(ctx: ScheduleContext): {
  status: "healthy" | "attention" | "critical";
  signals: string[];
} {
  const signals: string[] = [];

  if (ctx.sleep.metrics.debtMin > 120) signals.push("High sleep debt");
  if (ctx.sleep.metrics.consistency < 0.5) signals.push("Low sleep consistency");
  if (ctx.metrics.overloadScore > 0.8) signals.push("High overload risk");
  if (ctx.metrics.recoveryTimeMin < 60) signals.push("Low recovery time");
  if (ctx.goals.some((g) => g.progress < 0.1 && g.daysRemaining !== undefined && g.daysRemaining < 7)) signals.push("At-risk deadlines approaching");
  if (ctx.goals.filter((g) => g.progress < 0.1).length > ctx.goals.length / 2) signals.push("Majority of goals neglected");

  const status: "healthy" | "attention" | "critical" =
    signals.length === 0 ? "healthy" :
    signals.length <= 2 ? "attention" : "critical";

  return { status, signals };
}
