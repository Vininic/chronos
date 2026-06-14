import type { ScheduleContext } from "../context/ScheduleContext";

export interface WeeklyInsight {
  type: "pattern" | "optimization" | "imbalance" | "recommendation";
  detail: string;
  suggestion?: string;
}

/* ── Weekly routine analysis ─────────────────────────────── */
export function analyzeWeeklyRoutine(ctx: ScheduleContext): WeeklyInsight[] {
  const insights: WeeklyInsight[] = [];

  const weeklyMinutes = ctx.metrics.scheduledHours.reduce((s, h) => s + h * 60, 0);
  const avgDailyMinutes = weeklyMinutes / Math.max(1, 7);
  const todayMinutes = ctx.dailyStats[0]?.totalMinutes ?? 0;

  if (todayMinutes > avgDailyMinutes * 1.3) {
    insights.push({
      type: "imbalance",
      detail: `Today (${Math.round(todayMinutes / 60 * 10) / 10}h) is significantly busier than daily average (${Math.round(avgDailyMinutes / 60 * 10) / 10}h)`,
      suggestion: "Consider moving some low-priority blocks to lighter days",
    });
  }

  const categoryDistribution = new Map<string, number>();
  for (const b of ctx.blocks) {
    categoryDistribution.set(b.category, (categoryDistribution.get(b.category) ?? 0) + b.durationMin);
  }

  const sortedCats = [...categoryDistribution.entries()].sort((a, b) => b[1] - a[1]);
  if (sortedCats.length > 0) {
    const topCat = sortedCats[0];
    const topPct = Math.round(topCat[1] / Math.max(1, todayMinutes) * 100);
    if (topPct > 60) {
      insights.push({
        type: "imbalance",
        detail: `"${topCat[0]}" dominates ${topPct}% of today's schedule`,
        suggestion: "Ensure variety by distributing time across multiple categories",
      });
    }
  }

  return insights;
}

/* ── Weekly optimization ─────────────────────────────────── */
export function suggestWeeklyOptimization(ctx: ScheduleContext): WeeklyInsight[] {
  const insights: WeeklyInsight[] = [];

  const recoveryRatio = ctx.metrics.recoveryTimeMin / Math.max(1, ctx.metrics.focusTimeMin + ctx.metrics.recoveryTimeMin);
  if (recoveryRatio < 0.15) {
    insights.push({
      type: "optimization",
      detail: `Recovery accounts for only ${Math.round(recoveryRatio * 100)}% of scheduled time`,
      suggestion: "Add 2-3 recovery blocks this week (15-30min each)",
    });
  }

  const blockCount = ctx.blocks.length;
  const uniqueCategories = new Set(ctx.blocks.map((b) => b.category)).size;
  if (uniqueCategories <= 1 && blockCount > 2) {
    insights.push({
      type: "optimization",
      detail: "All blocks belong to a single category — consider diversifying",
      suggestion: "Explore different activity domains for better balance",
    });
  }

  return insights;
}

/* ── Pattern preservation ────────────────────────────────── */
export function detectPatternChanges(_ctx: ScheduleContext): WeeklyInsight[] {
  return [];
}

/* ── Adaptive restructuring ──────────────────────────────── */
export function suggestRestructuring(ctx: ScheduleContext): WeeklyInsight[] {
  const insights: WeeklyInsight[] = [];

  for (const g of ctx.goals) {
    if (g.progress < 0.1 && g.streak === 0 && ctx.weeklyStats.length > 0) {
      insights.push({
        type: "recommendation",
        detail: `Goal "${g.title}" has no progress and no active streak`,
        suggestion: `Schedule 2-3 dedicated blocks for "${g.title}" this week`,
      });
    }
  }

  return insights;
}

/* ── Run all weekly analyses ──────────────────────────────── */
export function analyzeWeek(ctx: ScheduleContext): WeeklyInsight[] {
  return [
    ...analyzeWeeklyRoutine(ctx),
    ...suggestWeeklyOptimization(ctx),
    ...detectPatternChanges(ctx),
    ...suggestRestructuring(ctx),
  ];
}
