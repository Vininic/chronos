import type { ScheduleContext, AiGoal } from "../context/ScheduleContext";

export interface GoalCorrelation {
  goalId: string;
  goalTitle: string;
  correlatedBlocks: number;
  totalMinutes: number;
  completionRate: number;
  gapAnalysis: string;
}

export function correlateGoalsWithBlocks(ctx: ScheduleContext): GoalCorrelation[] {
  return ctx.goals.map((g) => {
    const goalBlocks = ctx.blocks.filter((b) => g.categoryId ? b.category === g.categoryId : true);
    const completed = goalBlocks.filter((b) => b.complete).length;
    const total = goalBlocks.length;
    return {
      goalId: g.id,
      goalTitle: g.title,
      correlatedBlocks: total,
      totalMinutes: goalBlocks.reduce((s, b) => s + b.durationMin, 0),
      completionRate: total > 0 ? completed / total : 0,
      gapAnalysis: analyzeGoalGap(g, total),
    };
  });
}

function analyzeGoalGap(g: AiGoal, blockCount: number): string {
  if (blockCount === 0) return "No blocks correlated — schedule dedicated sessions";
  if (g.progress < 0.25 && blockCount < 3) return "Low progress with minimal block activity — increase frequency";
  if (g.progress > 0.75) return "Well on track — maintain current pace";
  return "Making progress — continue monitoring";
}

export function generateGoalDrivenSchedule(ctx: ScheduleContext): {
  priorityGoalIds: string[];
  suggestedCategories: string[];
  rationale: string;
} {
  const sorted = [...ctx.goals].sort((a, b) => {
    const aScore = goalUrgencyScore(a);
    const bScore = goalUrgencyScore(b);
    return bScore - aScore;
  });

  const priorityIds = sorted.slice(0, 3).map((g) => g.id);
  const suggestedCategories = [...new Set(sorted.slice(0, 3).map((g) => g.categoryId).filter(Boolean))] as string[];

  const rationale = sorted.length > 0
    ? `Top priority: "${sorted[0].title}" (urgency ${Math.round(goalUrgencyScore(sorted[0]) * 100) / 100}). ${suggestedCategories.length > 0 ? `Focus on categories: ${suggestedCategories.join(", ")}.` : ""}`
    : "No goals defined — consider setting at least one goal.";

  return { priorityGoalIds: priorityIds, suggestedCategories, rationale };
}

function goalUrgencyScore(g: AiGoal): number {
  let score = g.weight;
  if (g.daysRemaining !== undefined && g.daysRemaining < 3) score += 3;
  else if (g.daysRemaining !== undefined && g.daysRemaining < 7) score += 2;
  else if (g.daysRemaining !== undefined && g.daysRemaining < 14) score += 1;

  if (g.progress < 0.1) score += 2;
  else if (g.progress < 0.25) score += 1;
  else if (g.progress > 0.9) score -= 1;

  if (g.streak > 5) score += 1;
  if (g.streak === 0 && g.daysRemaining !== undefined) score += 1;

  return score;
}
