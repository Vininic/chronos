import type { DailyPattern, LearningProfile } from "../learning/types";
import { loadProfile } from "../learning/store";

export interface DetectedPattern {
  id: string;
  type: "declining-completion" | "skipped-day" | "recovery-drop" | "overload-trend";
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  actionable: boolean;
}

export function detectPatterns(profile?: LearningProfile): DetectedPattern[] {
  const p = profile ?? loadProfile();
  const patterns: DetectedPattern[] = [];
  const days = p.dailyPatterns;

  if (days.length < 3) return patterns;

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  // 1. Declining completion rate
  const recent = sorted.slice(-7);
  const older = sorted.slice(0, Math.max(3, sorted.length - 7));
  if (recent.length >= 3 && older.length >= 3) {
    const recentAvg = recent.reduce((s, d) => s + d.completionRate, 0) / recent.length;
    const olderAvg = older.reduce((s, d) => s + d.completionRate, 0) / older.length;
    if (olderAvg - recentAvg > 0.15) {
      patterns.push({
        id: "declining-completion",
        type: "declining-completion",
        title: "Completion rate is dropping",
        detail: `Your completion rate dropped from ${Math.round(olderAvg * 100)}% to ${Math.round(recentAvg * 100)}% over the last ${recent.length} days.`,
        severity: "high",
        actionable: true,
      });
    }
  }

  // 2. Recovery minutes dropping
  if (recent.length >= 3 && older.length >= 3) {
    const recentRec = recent.reduce((s, d) => s + d.recoveryMinutes, 0) / recent.length;
    const olderRec = older.reduce((s, d) => s + d.recoveryMinutes, 0) / older.length;
    if (olderRec - recentRec > 30 && olderRec > 0) {
      patterns.push({
        id: "recovery-drop",
        type: "recovery-drop",
        title: "Recovery time is declining",
        detail: `Your average daily recovery dropped from ${Math.round(olderRec)}min to ${Math.round(recentRec)}min.`,
        severity: "high",
        actionable: true,
      });
    }
  }

  // 3. Overload trend
  if (recent.length >= 3) {
    const recentOverload = recent.reduce((s, d) => s + d.overloadScore, 0) / recent.length;
    if (recentOverload > 0.6) {
      patterns.push({
        id: "overload-trend",
        type: "overload-trend",
        title: "Consistently high overload",
        detail: `Your overload score has averaged ${Math.round(recentOverload * 100)}% recently. Consider reducing block density.`,
        severity: "high",
        actionable: true,
      });
    }
  }

  // 4. Skipped patterns by day of week
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byDay: Record<number, DailyPattern[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const d of sorted) {
    const day = new Date(d.date + "T00:00:00").getDay();
    byDay[day].push(d);
  }

  for (const [dayIdx, dayPatterns] of Object.entries(byDay)) {
    if (dayPatterns.length < 3) continue;
    const recentDays = dayPatterns.slice(-4);
    const recentComp = recentDays.reduce((s, d) => s + d.completionRate, 0) / recentDays.length;
    const totalMin = recentDays.reduce((s, d) => s + d.totalMinutes, 0) / recentDays.length;
    if (recentComp < 0.3 && totalMin > 0) {
      patterns.push({
        id: `skipped-${dayIdx}`,
        type: "skipped-day",
        title: `${dayNames[parseInt(dayIdx)]}s are consistently low`,
        detail: `Recent ${dayNames[parseInt(dayIdx)]}s show only ${Math.round(recentComp * 100)}% completion with ${Math.round(totalMin)}min scheduled.`,
        severity: "medium",
        actionable: true,
      });
    }
  }

  patterns.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  return patterns;
}
