import type { ScheduleContext } from "../context/ScheduleContext";
import { parseMin, findGaps } from "../utils/time";

export interface DynamicPlanResult {
  newBlocks: DynamicBlockProposal[];
  scheduleRepairActions: string[];
  routineAdaptations: string[];
}

export interface DynamicBlockProposal {
  title: string;
  category: string;
  suggestedStart: string;
  suggestedEnd: string;
  day: number;
  reason: string;
}

export function generateDynamicBlocks(ctx: ScheduleContext): DynamicBlockProposal[] {
  const proposals: DynamicBlockProposal[] = [];
  const gaps = findDayGaps(ctx);
  const today = new Date().getDay();

  for (const gap of gaps) {
    const gapMin = parseMin(gap.end) - parseMin(gap.start);
    if (gapMin >= 60 && proposals.length < 3) {
      proposals.push({
        title: "Deep work session",
        category: "deep",
        suggestedStart: gap.start,
        suggestedEnd: gap.end,
        day: today,
        reason: `${Math.round(gapMin / 60 * 10) / 10}h gap available — optimal for focused work`,
      });
    } else if (gapMin >= 30 && proposals.length < 5) {
      proposals.push({
        title: "Quick task batch",
        category: "shallow",
        suggestedStart: gap.start,
        suggestedEnd: gap.end,
        day: today,
        reason: `${gapMin}min gap — suitable for shallow tasks or recovery`,
      });
    }
  }

  return proposals;
}

export function generateDynamicCommitments(ctx: ScheduleContext): string[] {
  const insights: string[] = [];
  for (const g of ctx.goals) {
    if (g.progress < 0.1 && g.streak === 0 && g.daysRemaining !== undefined && g.daysRemaining < 14) {
      insights.push(`Goal "${g.title}" needs immediate attention — ${g.daysRemaining} days remaining with ${Math.round(g.progress * 100)}% progress`);
    }
  }
  return insights;
}

export function repairSchedule(ctx: ScheduleContext): string[] {
  const actions: string[] = [];
  const recoveryRatio = ctx.metrics.recoveryTimeMin / Math.max(1, ctx.metrics.focusTimeMin);

  if (recoveryRatio < 0.1) {
    actions.push("Insert 3 recovery breaks (15min each) throughout the day");
  }

  const inProgress = ctx.blocks.filter((b) => b.inProgress && !b.complete);
  if (inProgress.length > 3) {
    actions.push(`Too many open sessions (${inProgress.length}) — complete or close at least ${inProgress.length - 3}`);
  }

  if (ctx.metrics.overloadScore > 0.8) {
    actions.push("Reduce total scheduled time by 60-90 minutes to prevent overload");
  }

  return actions;
}

export function adaptRoutine(ctx: ScheduleContext): string[] {
  const adaptations: string[] = [];
  const highCompletionCats = new Map<string, number>();
  const lowCompletionCats = new Map<string, number>();

  for (const h of ctx.historicalCompletion) {
    if (h.completed) {
      highCompletionCats.set(h.category, (highCompletionCats.get(h.category) ?? 0) + 1);
    } else {
      lowCompletionCats.set(h.category, (lowCompletionCats.get(h.category) ?? 0) + 1);
    }
  }

  for (const [cat, count] of highCompletionCats) {
    if (count >= 3) {
      const existingBlocks = ctx.blocks.filter((b) => b.category === cat);
      if (existingBlocks.length === 0) {
        adaptations.push(`High completion rate in "${cat}" — consider adding it back to your routine`);
      }
    }
  }

  for (const [cat, count] of lowCompletionCats) {
    if (count >= 3) {
      adaptations.push(`Low completion rate in "${cat}" — consider reducing frequency or changing approach`);
    }
  }

  return adaptations;
}

function findDayGaps(ctx: ScheduleContext): { start: string; end: string; durationMin: number }[] {
  return findGaps(ctx);
}
