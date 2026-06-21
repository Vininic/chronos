import type { ScheduleData } from "./types";
import { timeToMinutes, computeGoalProgress } from "./types";
import { clamp } from "./helpers";
import { migrateSleepSchedule, getSleepWindowForDay } from "./sleep";

export function recomputeOverallGoalProgress(data: ScheduleData, today?: string): number {
  const goals = data.goals;
  if (goals.length === 0) return 0;
  const todayIso = today ?? new Date().toISOString().slice(0, 10);
  let totalWeight = 0;
  let weightedSum = 0;
  for (const g of goals) {
    const p = computeGoalProgress(g, todayIso, data.goals, data.routine, data.commitments);
    if (p.denominator > 0) {
      totalWeight += g.weight;
      weightedSum += g.weight * p.ratio;
    }
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

export function buildLedger(data: ScheduleData, today?: string): ScheduleData["ledger"] {
  const catSet = new Set(data.routine.map((r) => r.kind));
  const catCount = catSet.size;

  const totalRoutineMin = data.routine.reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);

  const maxCatMin = Math.max(1, ...data.categories.map((c) =>
    data.routine.filter((r) => r.kind === c.id)
      .reduce((s, r) => s + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0)
  ));
  const topCatRatio = maxCatMin / Math.max(1, totalRoutineMin);

  const weekdays = [1, 2, 3, 4, 5];
  const dayMins = weekdays.map((d) =>
    data.routine.filter((r) => r.day === d)
      .reduce((s, r) => s + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0)
  );
  const avgDayMin = dayMins.reduce((s, v) => s + v, 0) / Math.max(1, dayMins.length);
  const variance = dayMins.reduce((s, v) => s + (v - avgDayMin) ** 2, 0) / Math.max(1, dayMins.length);
  const consistencyScore = clamp(Math.round((1 - Math.min(1, Math.sqrt(variance) / Math.max(1, avgDayMin))) * 100));
  const loadScore = clamp(Math.round((totalRoutineMin / (40 * 60)) * 100));
  const varietyScore = clamp(Math.round((catCount / Math.max(1, data.categories.length)) * 100));

  const compositionScore = clamp(
    Math.round(loadScore * 0.45 + consistencyScore * 0.3 + varietyScore * 0.25),
  );

  const focusCatIds = data.meta.focusCategoryIds ?? [];
  const focusMin = data.categories
    .filter((c) => focusCatIds.includes(c.id))
    .flatMap((c) => data.routine.filter((r) => r.kind === c.id))
    .reduce((s, r) => s + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);
  const recoveryCatIds = new Set(data.categories.filter((c) => c.role === "recovery").map((c) => c.id));
  const recoveryMin = data.routine
    .filter((r) => recoveryCatIds.has(r.kind))
    .reduce((s, r) => s + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);

  const focusScore = clamp(Math.round(totalRoutineMin > 0 ? (focusMin / totalRoutineMin) * 100 : 0));
  const recoveryScore = clamp(Math.round(totalRoutineMin > 0 ? (recoveryMin / totalRoutineMin) * 100 : 0));

  const goalProgress = Math.round(recomputeOverallGoalProgress(data, today) * 100);

  const metrics = [
    { label: "Load", value: loadScore },
    { label: "Consistency", value: consistencyScore },
    { label: "Variety", value: varietyScore },
    { label: "Focus", value: focusScore },
    { label: "Recovery", value: recoveryScore },
    { label: "Goals", value: goalProgress },
  ];

  const scheduledHours = Array.from({ length: 14 }, (_, i) => {
    const d = i % 7;
    const total = data.routine
      .filter((r) => r.day === d)
      .reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);
    return Number((total / 60).toFixed(1));
  });

  return { compositionScore, metrics, scheduledHours };
}
