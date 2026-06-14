import type { ScheduleContext } from "../context/ScheduleContext";
import { findGaps, parseMin, fmtMin } from "../utils/time";

let _sugCounter = 0;
function sugId(type: string): string {
  return `sug-${type}-${_sugCounter++}`;
}

export interface Suggestion {
  id: string;
  type: "block" | "commitment_fit" | "gap" | "focus_session" | "deep_work" | "recovery" | "habit";
  title: string;
  detail: string;
  priority: "low" | "medium" | "high";
  actionable: boolean;
}

export function generateSuggestions(ctx: ScheduleContext): Suggestion[] {
  _sugCounter = 0;
  const suggestions: Suggestion[] = [];

  suggestions.push(...suggestEmptyGapBlocks(ctx));
  suggestions.push(...suggestFocusSessions(ctx));
  suggestions.push(...suggestDeepWork(ctx));
  suggestions.push(...suggestRecovery(ctx));
  suggestions.push(...suggestHabitReinforcement(ctx));

  return suggestions.sort((a, b) => {
    const p = { high: 3, medium: 2, low: 1 };
    return p[b.priority] - p[a.priority];
  });
}

function suggestEmptyGapBlocks(ctx: ScheduleContext): Suggestion[] {
  const results: Suggestion[] = [];
  const gaps = findGaps(ctx);
  for (const gap of gaps.slice(0, 3)) {
    results.push({
      id: sugId("gap"),
      type: "gap",
      title: `Empty gap at ${gap.start}-${gap.end} (${Math.round(gap.durationMin / 60 * 10) / 10}h)`,
      detail: `No blocks scheduled between ${gap.start} and ${gap.end}`,
      priority: "medium",
      actionable: true,
    });
  }
  return results;
}

function suggestFocusSessions(ctx: ScheduleContext): Suggestion[] {
  const results: Suggestion[] = [];
  const inProgress = ctx.blocks.filter((b) => b.inProgress && !b.complete);
  for (const block of inProgress.slice(0, 3)) {
    results.push({
      id: sugId("focus"),
      type: "focus_session",
      title: `Continue "${block.title}" session`,
      detail: `Unfinished ${block.category} session (${block.programProgress.done}/${block.programProgress.total})`,
      priority: "high",
      actionable: true,
    });
  }
  return results;
}

function suggestDeepWork(ctx: ScheduleContext): Suggestion[] {
  const results: Suggestion[] = [];
  const deepCategoryIds = ctx.categories
    .filter((c) => ["deep", "focus"].includes(c.id) || c.label.toLowerCase().includes("deep"))
    .map((c) => c.id);

  for (const catId of deepCategoryIds) {
    const blocks = ctx.blocks.filter((b) => b.category === catId);
    const totalDeepMin = blocks.reduce((s, b) => s + b.durationMin, 0);
    if (totalDeepMin < 120) {
      results.push({
        id: sugId("deep"),
        type: "deep_work",
        title: `Only ${Math.round(totalDeepMin / 60 * 10) / 10}h of deep work today`,
        detail: "Deep work sessions should total at least 2 hours for meaningful progress",
        priority: totalDeepMin < 60 ? "high" : "medium",
        actionable: true,
      });
    }
  }
  return results;
}

function suggestRecovery(ctx: ScheduleContext): Suggestion[] {
  const results: Suggestion[] = [];
  const totalMin = ctx.blocks.reduce((s, b) => s + b.durationMin, 0);
  const recoveryMin = ctx.metrics.recoveryTimeMin;
  const ratio = recoveryMin / Math.max(1, totalMin);

  if (ratio < 0.15) {
    results.push({
      id: sugId("recovery"),
      type: "recovery",
      title: `Recovery is only ${Math.round(ratio * 100)}% of schedule (target: 15-20%)`,
      detail: "Insufficient recovery increases burnout risk and reduces cognitive performance",
      priority: ratio < 0.1 ? "high" : "medium",
      actionable: true,
    });
  }
  return results;
}

function suggestHabitReinforcement(ctx: ScheduleContext): Suggestion[] {
  const results: Suggestion[] = [];
  const highCompletion = ctx.historicalCompletion.filter((h) => h.completed).length;
  const total = ctx.historicalCompletion.length;

  if (total > 5 && highCompletion / total > 0.7) {
    const categories = new Set(ctx.historicalCompletion.filter((h) => h.completed).map((h) => h.category));
    for (const cat of categories) {
      const catBlocks = ctx.blocks.filter((b) => b.category === cat);
      if (catBlocks.length === 0) {
        results.push({
          id: sugId("habit"),
          type: "habit",
          title: `High-success category "${cat}" has no blocks scheduled`,
          detail: "You consistently complete this category — consider adding it to your routine",
          priority: "medium",
          actionable: true,
        });
      }
    }
  }
  return results;
}
