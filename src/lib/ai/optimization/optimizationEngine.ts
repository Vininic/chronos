import type { ScheduleContext } from "../context/ScheduleContext";
import { parseMin, findGaps } from "../utils/time";

export interface OptimizationResult {
  conflicts: ConflictDetected[];
  idleGaps: IdleGap[];
  timeAllocation: TimeAllocation;
  focusFragmentation: number;
  routineConsistency: number;
  recommendations: string[];
}

export interface ConflictDetected {
  type: "overlap" | "sleep_overlap";
  blockIds: string[];
  detail: string;
}

export interface IdleGap {
  start: string;
  end: string;
  durationMin: number;
  suggestion?: string;
}

export interface TimeAllocation {
  categoryMinutes: Record<string, number>;
  focusPct: number;
  recoveryPct: number;
  sleepPct: number;
}

export function optimizeSchedule(ctx: ScheduleContext): OptimizationResult {
  return {
    conflicts: detectConflicts(ctx),
    idleGaps: findIdleGaps(ctx),
    timeAllocation: analyzeTimeAllocation(ctx),
    focusFragmentation: calculateFragmentation(ctx),
    routineConsistency: calculateRoutineConsistency(ctx),
    recommendations: generateOptimizationRecommendations(ctx),
  };
}

function detectConflicts(ctx: ScheduleContext): ConflictDetected[] {
  const conflicts: ConflictDetected[] = [];

  for (let i = 0; i < ctx.blocks.length; i++) {
    for (let j = i + 1; j < ctx.blocks.length; j++) {
      const a = ctx.blocks[i];
      const b = ctx.blocks[j];
      if (parseMin(a.start) < parseMin(b.end) && parseMin(b.start) < parseMin(a.end)) {
        conflicts.push({
          type: "overlap",
          blockIds: [a.id, b.id],
          detail: `"${a.title}" and "${b.title}" overlap (${a.start}-${a.end} vs ${b.start}-${b.end})`,
        });
      }
    }
  }

  for (const s of ctx.sleep.blocks) {
    for (const b of ctx.blocks) {
      if (parseMin(b.start) < parseMin(s.end) && parseMin(s.start) < parseMin(b.end)) {
        conflicts.push({
          type: "sleep_overlap",
          blockIds: [b.id, s.id],
          detail: `"${b.title}" overlaps with sleep (${s.start}-${s.end})`,
        });
      }
    }
  }

  return conflicts;
}

function findIdleGaps(ctx: ScheduleContext): IdleGap[] {
  return findGaps(ctx).map((g) => ({
    ...g,
    suggestion: g.durationMin >= 60
      ? "Consider scheduling a deep work session here"
      : "Short gap — use for recovery or shallow tasks",
  }));
}

function analyzeTimeAllocation(ctx: ScheduleContext): TimeAllocation {
  const categoryMinutes: Record<string, number> = {};
  let total = 0;

  for (const b of ctx.blocks) {
    categoryMinutes[b.category] = (categoryMinutes[b.category] ?? 0) + b.durationMin;
    total += b.durationMin;
  }

  const focusMin = ctx.metrics.focusTimeMin;
  const recoveryMin = ctx.metrics.recoveryTimeMin;
  const sleepMin = ctx.sleep.metrics.averageDurationMin;

  return {
    categoryMinutes,
    focusPct: total > 0 ? focusMin / total : 0,
    recoveryPct: total > 0 ? recoveryMin / total : 0,
    sleepPct: total > 0 ? sleepMin / (sleepMin + total) : 0,
  };
}

function calculateFragmentation(ctx: ScheduleContext): number {
  if (ctx.blocks.length < 3) return 0;
  let switches = 0;
  for (let i = 1; i < ctx.blocks.length; i++) {
    if (ctx.blocks[i].category !== ctx.blocks[i - 1].category) switches++;
  }
  return Math.min(1, switches / (ctx.blocks.length - 1));
}

function calculateRoutineConsistency(ctx: ScheduleContext): number {
  if (ctx.blocks.length < 2) return 1;
  const startTimes = ctx.blocks.map((b) => parseMin(b.start));
  const mean = startTimes.reduce((s, v) => s + v, 0) / startTimes.length;
  const variance = Math.sqrt(startTimes.reduce((s, v) => s + (v - mean) ** 2, 0) / startTimes.length);
  return Math.max(0, Math.min(1, 1 - variance / (12 * 60)));
}

function generateOptimizationRecommendations(result: OptimizationResult): string[] {
  const recs: string[] = [];
  if (result.conflicts.length > 0) recs.push(`Resolve ${result.conflicts.length} scheduling conflict(s)`);
  if (result.idleGaps.length > 0) recs.push(`Fill ${result.idleGaps.length} idle gap(s) totaling ${result.idleGaps.reduce((s, g) => s + g.durationMin, 0)}min`);
  if (result.focusFragmentation > 0.4) recs.push("Reduce context switching by batching similar activities");
  if (result.routineConsistency < 0.5) recs.push("Improve routine consistency by anchoring blocks to fixed times");
  return recs;
}
