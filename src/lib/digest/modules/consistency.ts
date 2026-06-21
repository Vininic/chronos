import type { ScheduleData, Goal } from "@/lib/schedule/types";
import type { ReportCard } from "../types";
import { computeStreak } from "@/lib/schedule/types";
import type { DigestContext } from "./helpers";

export function consistencyAnalysis(data: ScheduleData, ctx: DigestContext): ReportCard[] {
  const cards: ReportCard[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // Recurring goals only (period-based); deadline/total goals have no streak.
  const recurring = data.goals.filter((g) => g.period === "daily" || g.period === "weekly" || g.period === "monthly");

  if (recurring.length > 0) {
    const withStreak = recurring.map((g) => ({ goal: g, streak: computeStreak(g as Goal, today) }));

    // ── Goals on a streak (positive reinforcement) ────────────────────
    const onStreak = withStreak.filter((x) => x.streak >= 2).sort((a, b) => b.streak - a.streak);
    if (onStreak.length > 0) {
      const best = onStreak[0];
      cards.push({
        kind: "consistency",
        severity: "trend",
        title: `${onStreak.length} goal${onStreak.length > 1 ? "s" : ""} on an active streak`,
        body: `Best run: "${best.goal.title}" at ${best.streak} ${best.goal.period === "daily" ? "days" : best.goal.period === "weekly" ? "weeks" : "months"} in a row.`,
      });
    }

    // ── Goals that have lapsed (no current streak) ────────────────────
    const lapsed = withStreak.filter((x) => x.streak === 0);
    if (lapsed.length > 0) {
      const names = lapsed.slice(0, 2).map((x) => `"${x.goal.title}"`).join(", ");
      cards.push({
        kind: "consistency",
        severity: "insight",
        title: `${lapsed.length} goal${lapsed.length > 1 ? "s" : ""} with no active streak`,
        body: lapsed.length <= 2
          ? `${names} ${lapsed.length > 1 ? "have" : "has"} lapsed. Completing the current period restarts the streak.`
          : `${lapsed.length} recurring goals have lapsed this period.`,
        actionable: true,
      });
    }
  }

  // ── Monthly: completed-period consistency rate from snapshots ───────
  if (ctx.timeframe === "monthly") {
    const snapshots = data.progressSnapshots;
    if (snapshots.length > 0) {
      const done = snapshots.filter((s) => s.denominator > 0 && s.numerator >= s.denominator).length;
      const rate = Math.round((done / snapshots.length) * 100);
      cards.push({
        kind: "consistency",
        severity: "insight",
        title: `Monthly consistency rate: ${rate}%`,
        body: `${done} of ${snapshots.length} tracked goal periods were completed this month.`,
      });
    }
  }

  return cards;
}
