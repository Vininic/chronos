import type { ScheduleContext } from "../context/ScheduleContext";
import { parseMin } from "../utils/time";

export interface AdaptiveWeekResult {
  weeklyReview: WeeklyReview;
  optimizationSuggestions: string[];
  restructuringPlan: RestructuringAction[];
}

export interface WeeklyReview {
  totalBlocks: number;
  totalHours: number;
  categoryBreakdown: Record<string, number>;
  completionRate: number;
  recoveryRatio: number;
  overloadRisk: "low" | "medium" | "high";
  sleepQuality: number;
}

export interface RestructuringAction {
  type: "move" | "add" | "remove" | "reschedule";
  detail: string;
  reason: string;
  priority: "low" | "medium" | "high";
}

export function performWeeklyReview(ctx: ScheduleContext): AdaptiveWeekResult {
  const review = generateWeeklyReview(ctx);
  const optimizationSuggestions = generateOptimizations(ctx);
  const restructuringPlan = generateRestructuring(ctx, review);
  return { weeklyReview: review, optimizationSuggestions, restructuringPlan };
}

function generateWeeklyReview(ctx: ScheduleContext): WeeklyReview {
  const totalMin = ctx.blocks.reduce((s, b) => s + b.durationMin, 0);
  const completed = ctx.blocks.filter((b) => b.complete).length;
  const breakdown: Record<string, number> = {};
  for (const b of ctx.blocks) {
    breakdown[b.category] = (breakdown[b.category] ?? 0) + b.durationMin;
  }

  const overloadRatio = totalMin / Math.max(1, parseMin(ctx.workday.end) - parseMin(ctx.workday.start));
  const overloadRisk = overloadRatio > 1.3 ? "high" : overloadRatio > 1 ? "medium" : "low";

  return {
    totalBlocks: ctx.blocks.length,
    totalHours: Math.round(totalMin / 60 * 10) / 10,
    categoryBreakdown: breakdown,
    completionRate: ctx.blocks.length > 0 ? completed / ctx.blocks.length : 0,
    recoveryRatio: ctx.metrics.recoveryTimeMin / Math.max(1, ctx.metrics.focusTimeMin),
    overloadRisk,
    sleepQuality: ctx.sleep.metrics.consistency,
  };
}

function generateOptimizations(ctx: ScheduleContext): string[] {
  const suggestions: string[] = [];
  const review = generateWeeklyReview(ctx);

  if (review.recoveryRatio < 0.15) {
    suggestions.push("Add 2-3 recovery blocks — current recovery ratio is below recommended 15-20%");
  }
  if (review.overloadRisk === "high") {
    suggestions.push("Schedule exceeds daily capacity — consider removing or shortening low-priority blocks");
  }
  if (review.sleepQuality < 0.6) {
    suggestions.push("Sleep consistency is low — review bedtime routine and wind-down habits");
  }
  if (review.completionRate < 0.5) {
    suggestions.push(`Only ${Math.round(review.completionRate * 100)}% of blocks completed — reduce total block count to achievable levels`);
  }

  const dominantCategory = Object.entries(review.categoryBreakdown)
    .sort(([, a], [, b]) => b - a)[0];
  if (dominantCategory && dominantCategory[1] / Math.max(1, review.totalHours * 60) > 0.6) {
    suggestions.push(`"${dominantCategory[0]}" dominates ${Math.round(dominantCategory[1] / (review.totalHours * 60) * 100)}% of schedule — diversify categories for better balance`);
  }

  return suggestions;
}

function generateRestructuring(ctx: ScheduleContext, review: WeeklyReview): RestructuringAction[] {
  const actions: RestructuringAction[] = [];

  if (review.overloadRisk === "high") {
    const recoveryCount = ctx.blocks.filter((b) => b.category === "recovery").length;
    if (recoveryCount < 3) {
      actions.push({
        type: "add",
        detail: "Insert recovery blocks on overloaded days",
        reason: "Reduce overload risk and prevent burnout",
        priority: "high",
      });
    }
  }

  if (review.completionRate < 0.4) {
    actions.push({
      type: "remove",
      detail: "Remove lowest-priority blocks until completion rate exceeds 50%",
      reason: "Over-scheduling leads to low completion — fewer, focused commitments are more effective",
      priority: "high",
    });
  }

  const recoveryRecs = ctx.blocks.filter((b) => b.category === "recovery");
  if (recoveryRecs.length === 0) {
    actions.push({
      type: "add",
      detail: "Add at least one recovery block per day",
      reason: "No recovery time detected — essential for sustainable productivity",
      priority: "medium",
    });
  }

  const deepBlocks = ctx.blocks.filter((b) => b.category === "deep" || b.category === "focus");
  if (deepBlocks.length < 2) {
    actions.push({
      type: "add",
      detail: "Schedule 2-3 deep work sessions this week",
      reason: "Deep work drives meaningful progress on complex goals",
      priority: "medium",
    });
  }

  return actions;
}


