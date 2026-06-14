import type { ScheduleContext, AiGoal } from "../context/ScheduleContext";

export interface GoalInsight {
  type: "neglected" | "conflicting" | "over_prioritized" | "at_risk" | "on_track";
  goalId: string;
  goalTitle: string;
  detail: string;
  suggestion?: string;
}

/* ── Correlate goals with blocks ─────────────────────────── */
export function correlateGoalWithBlocks(ctx: ScheduleContext, goal: AiGoal): {
  blockCount: number;
  totalMinutes: number;
  recentBlockTitles: string[];
} {
  const goalBlocks = ctx.blocks.filter((b) => goal.categoryId ? b.category === goal.categoryId : true);
  return {
    blockCount: goalBlocks.length,
    totalMinutes: goalBlocks.reduce((s, b) => s + b.durationMin, 0),
    recentBlockTitles: goalBlocks.slice(0, 5).map((b) => b.title),
  };
}

/* ── Detect neglected goals ──────────────────────────────── */
export function detectNeglectedGoals(ctx: ScheduleContext): GoalInsight[] {
  const results: GoalInsight[] = [];

  for (const g of ctx.goals) {
    const { blockCount, totalMinutes } = correlateGoalWithBlocks(ctx, g);
    const weeksSinceStart = g.daysRemaining !== undefined
      ? ctx.weeklyStats.length
      : 0;

    if (g.progress < 0.1 && weeksSinceStart >= 2) {
      results.push({
        type: "neglected",
        goalId: g.id,
        goalTitle: g.title,
        detail: `Less than 10% progress after ${weeksSinceStart} weeks (${blockCount} blocks, ${totalMinutes}min)`,
        suggestion: `Add at least 2 weekly blocks for "${g.title}" to restart progress`,
      });
    }
  }

  return results;
}

/* ── Detect conflicting goals ────────────────────────────── */
export function detectConflictingGoals(ctx: ScheduleContext): GoalInsight[] {
  const results: GoalInsight[] = [];

  for (let i = 0; i < ctx.goals.length; i++) {
    for (let j = i + 1; j < ctx.goals.length; j++) {
      const a = ctx.goals[i];
      const b = ctx.goals[j];
      if (!a.categoryId || !b.categoryId) continue;
      if (a.categoryId === b.categoryId) {
        results.push({
          type: "conflicting",
          goalId: a.id,
          goalTitle: a.title,
          detail: `"${a.title}" and "${b.title}" share the same category (${a.categoryId})`,
          suggestion: "Consider assigning distinct categories or merging related goals",
        });
      }
    }
  }

  return results;
}

/* ── Detect over-prioritized goals ───────────────────────── */
export function detectOverPrioritizedGoals(ctx: ScheduleContext): GoalInsight[] {
  const results: GoalInsight[] = [];
  const maxWeight = Math.max(...ctx.goals.map((g) => g.weight), 0);

  for (const g of ctx.goals) {
    if (g.weight >= maxWeight && maxWeight > 1) {
      const { totalMinutes } = correlateGoalWithBlocks(ctx, g);
      const avgMinPerGoal = ctx.blocks.reduce((s, b) => s + b.durationMin, 0) / Math.max(1, ctx.goals.length);

      if (totalMinutes > avgMinPerGoal * 1.5) {
        results.push({
          type: "over_prioritized",
          goalId: g.id,
          goalTitle: g.title,
          detail: `Highest weight (${g.weight}) with ${totalMinutes}min allocated (${Math.round(totalMinutes / avgMinPerGoal * 100)}% of average)`,
          suggestion: "Consider redistributing time to neglected goals",
        });
      }
    }
  }

  return results;
}

/* ── Goal-based prioritization score ─────────────────────── */
export function goalPriorityScore(g: AiGoal): number {
  let score = g.weight;
  if (g.daysRemaining !== undefined && g.daysRemaining < 7) score += 2;
  if (g.progress < 0.25) score += 1;
  if (g.streak > 0) score += 0.5;
  return score;
}

/* ── Analyze all goals ───────────────────────────────────── */
export function analyzeGoals(ctx: ScheduleContext): GoalInsight[] {
  return [
    ...detectNeglectedGoals(ctx),
    ...detectConflictingGoals(ctx),
    ...detectOverPrioritizedGoals(ctx),
  ];
}
