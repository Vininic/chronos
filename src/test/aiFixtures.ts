/* Shared AI test fixtures (not a *.test file, so vitest won't collect it as a suite).
 * Factory helpers for building a ScheduleContext and its parts with sane defaults. */
import type {
  ScheduleContext,
  AiBlock,
  AiSleepBlock,
  AiCommitment,
  AiGoal,
  AiProgram,
  AiMetrics,
} from "@/lib/ai/context/ScheduleContext";

export function block(over: Partial<AiBlock> & Pick<AiBlock, "id" | "start" | "end">): AiBlock {
  return {
    title: over.id,
    category: "deep",
    durationMin: 60,
    hasProgram: false,
    programProgress: { done: 0, total: 0 },
    inProgress: false,
    complete: false,
    source: "routine",
    ...over,
  } as AiBlock;
}

export function sleep(start: string, end: string): AiSleepBlock {
  return { id: `sleep-${start}`, start, end, durationMin: 0, isSleepBoundary: true };
}

export function commitment(
  over: Partial<AiCommitment> & Pick<AiCommitment, "id" | "start" | "end" | "commitmentType">,
): AiCommitment {
  return { title: over.id, category: "meeting", done: false, ...over } as AiCommitment;
}

export function goal(categoryId: string, over: Partial<AiGoal> = {}): AiGoal {
  return {
    id: `goal-${categoryId}`,
    title: `Goal for ${categoryId}`,
    kind: "duration",
    tracking: "minutes",
    period: "weekly",
    categoryId,
    target: 100,
    weight: 1,
    progress: 0,
    streak: 0,
    ...over,
  } as AiGoal;
}

export function program(over: Partial<AiProgram> & Pick<AiProgram, "done" | "total">): AiProgram {
  return {
    categoryId: "deep",
    categoryLabel: "Deep Work",
    templateName: "Course",
    ...over,
  } as AiProgram;
}

export const ZERO_METRICS: AiMetrics = {
  compositionScore: 0,
  scheduledHours: [],
  focusTimeMin: 0,
  recoveryTimeMin: 0,
  consistencyScore: 0,
  overloadScore: 0,
};

export function makeCtx(over: Partial<ScheduleContext> = {}): ScheduleContext {
  return {
    version: 1,
    generatedAt: "2026-06-24T00:00:00Z",
    owner: "Test",
    cycle: { name: "Cycle", number: 1, week: 1, progress: 0 },
    workday: { start: "09:00", end: "18:00" },
    blocks: [],
    sleep: { blocks: [], metrics: { averageDurationMin: 0, consistency: 0, debtMin: 0, schedule: [] } },
    commitments: [],
    goals: [],
    categories: [],
    programs: [],
    notes: [],
    metrics: { ...ZERO_METRICS },
    dailyStats: [],
    weeklyStats: [],
    historicalCompletion: [],
    autonomy: "balanced",
    ...over,
  };
}
