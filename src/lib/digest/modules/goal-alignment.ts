import type { ScheduleData } from "@/lib/schedule/types";
import type { ReportCard } from "../types";
import { daysUntilDeadline } from "@/lib/schedule/types";
import type { DigestContext } from "./helpers";
import { categoryLabel } from "./helpers";

export function goalAlignmentAnalysis(data: ScheduleData, ctx: DigestContext): ReportCard[] {
  const cards: ReportCard[] = [];
  const goals = data.goals;
  const snapshots = data.progressSnapshots;

  if (goals.length === 0) {
    cards.push({
      kind: "goal-alignment",
      severity: "insight",
      title: "No goals set",
      body: "Goals align daily blocks with long-term priorities. Define at least one to unlock progress tracking.",
      actionable: true,
    });
    return cards;
  }

  // ── High-priority goals ─────────────────────────────────────────────
  const highPriority = goals.filter((g) => g.weight >= 3);
  if (highPriority.length > 0) {
    const names = highPriority.slice(0, 3).map((g) => `"${g.title}"`).join(", ");
    cards.push({
      kind: "goal-alignment",
      severity: "insight",
      title: `${highPriority.length} high-priority goal${highPriority.length > 1 ? "s" : ""} tracked`,
      body: `Your top priorit${highPriority.length > 1 ? "ies are" : "y is"} ${names}.`,
    });
  }

  // ── Category goals with nothing scheduled toward them ───────────────
  const scheduledKinds = new Set(ctx.blocks.map((b) => b.kind));
  const orphanGoals = goals.filter(
    (g) => g.tracking === "category" && g.categoryId && !scheduledKinds.has(g.categoryId),
  );
  if (orphanGoals.length > 0) {
    const g = orphanGoals[0];
    const scope = ctx.timeframe === "daily" ? "today" : ctx.timeframe === "weekly" ? "this week" : "in this period";
    cards.push({
      kind: "goal-alignment",
      severity: "warning",
      title: orphanGoals.length === 1
        ? `"${g.title}" has no time scheduled ${scope}`
        : `${orphanGoals.length} goals have no time scheduled ${scope}`,
      body: orphanGoals.length === 1
        ? `Nothing in the ${categoryLabel(data, g.categoryId!)} category is scheduled ${scope}, yet it has an active goal.`
        : `${orphanGoals.map((x) => `"${x.title}"`).slice(0, 3).join(", ")} have no matching blocks ${scope}.`,
      actionable: true,
    });
  }

  // ── Monthly: per-goal progress decline ──────────────────────────────
  if (ctx.timeframe === "monthly" && snapshots.length > 0) {
    const goalSnaps = new Map<string, { first: number; last: number; label: string }>();
    for (const s of snapshots) {
      const goal = goals.find((g) => g.id === s.goalId);
      if (!goal) continue;
      const ratio = s.denominator > 0 ? s.numerator / s.denominator : 0;
      const entry = goalSnaps.get(s.goalId);
      if (!entry) goalSnaps.set(s.goalId, { first: ratio, last: ratio, label: goal.title });
      else entry.last = ratio;
    }
    for (const [, entry] of goalSnaps) {
      if (entry.last < entry.first && entry.last < 0.5) {
        cards.push({
          kind: "goal-alignment",
          severity: "insight",
          title: `Goal "${entry.label}" progress declined`,
          body: `Progress went from ${Math.round(entry.first * 100)}% to ${Math.round(entry.last * 100)}% this month.`,
        });
      }
    }
  }

  // ── Deadlines approaching within 7 days ─────────────────────────────
  const approaching = goals.filter((g) => {
    if (g.kind !== "deadline" || !g.deadline) return false;
    const left = daysUntilDeadline(g.deadline);
    return left >= 0 && left <= 7;
  });
  if (approaching.length > 0) {
    cards.push({
      kind: "goal-alignment",
      severity: "warning",
      title: `${approaching.length} deadline${approaching.length > 1 ? "s" : ""} approaching`,
      body: approaching
        .map((g) => `"${g.title}" (${daysUntilDeadline(g.deadline!)}d left)`)
        .join(", "),
      actionable: true,
    });
  }

  return cards;
}
