export type AutonomyLevel = "conservative" | "balanced" | "aggressive";

export interface AiBlock {
  id: string;
  title: string;
  titleCustom?: string;
  category: string;
  start: string;
  end: string;
  durationMin: number;
  notes?: string;
  hasProgram: boolean;
  programName?: string;
  programProgress: { done: number; total: number };
  inProgress: boolean;
  complete: boolean;
  source: "routine" | "commitment";
  day?: number;
  isFocus?: boolean;
}

export interface AiSleepBlock {
  id: string;
  start: string;
  end: string;
  durationMin: number;
  isSleepBoundary: boolean;
}

export interface AiSleepMetrics {
  averageDurationMin: number;
  consistency: number;
  debtMin: number;
  schedule: { start: string; end: string; days: number[] }[];
}

export interface AiCommitment {
  id: string;
  title: string;
  titleCustom?: string;
  category: string;
  start: string;
  end: string;
  date?: string;
  endDate?: string;
  notes?: string;
  commitmentType: "fixed" | "flexible";
  done: boolean;
}

export interface AiGoal {
  id: string;
  title: string;
  description?: string;
  kind: "duration" | "numeric" | "deadline";
  tracking: string;
  period: string;
  categoryId?: string;
  target: number;
  unit?: string;
  weight: number;
  deadline?: string;
  progress: number;
  daysRemaining?: number;
  streak: number;
}

export interface AiCategory {
  id: string;
  label: string;
  description: string;
  color?: string;
  hasProgram: boolean;
  programCount: number;
  weeklyBlockCount: number;
}

export interface AiProgram {
  categoryId: string;
  categoryLabel: string;
  templateName: string;
  done: number;
  total: number;
  lastUsed?: string;
}

export interface AiNote {
  sourceType: "block" | "commitment";
  sourceId: string;
  sourceTitle: string;
  text: string;
  date: string;
  category: string;
}

export interface AiMetrics {
  compositionScore: number;
  scheduledHours: number[];
  focusTimeMin: number;
  recoveryTimeMin: number;
  consistencyScore: number;
  overloadScore: number;
}

export interface DailyStats {
  date: string;
  totalBlocks: number;
  completedBlocks: number;
  totalMinutes: number;
  focusMinutes: number;
  recoveryMinutes: number;
  sleepMinutes: number;
}

export interface WeeklyStats {
  weekStart: string;
  totalMinutes: number;
  focusMinutes: number;
  recoveryMinutes: number;
  avgSleepMinutes: number;
  completionRate: number;
  dayCount: number;
}

export interface HistoricalCompletion {
  date: string;
  blockId: string;
  blockTitle: string;
  category: string;
  durationMin: number;
  completed: boolean;
}

export interface ScheduleContext {
  version: 1;
  generatedAt: string;
  owner: string;
  cycle: { name: string; number: number; week: number; progress: number };
  workday: { start: string; end: string };
  blocks: AiBlock[];
  sleep: { blocks: AiSleepBlock[]; metrics: AiSleepMetrics };
  commitments: AiCommitment[];
  goals: AiGoal[];
  categories: AiCategory[];
  programs: AiProgram[];
  notes: AiNote[];
  metrics: AiMetrics;
  dailyStats: DailyStats[];
  weeklyStats: WeeklyStats[];
  historicalCompletion: HistoricalCompletion[];
  autonomy: AutonomyLevel;
}

export interface BlockSummary {
  total: number;
  routine: number;
  commitment: number;
  completed: number;
  inProgress: number;
  totalMinutes: number;
  focusMinutes: number;
}

export function summarizeBlocks(blocks: AiBlock[]): BlockSummary {
  const total = blocks.length;
  const routine = blocks.filter((b) => b.source === "routine").length;
  const commitment = blocks.filter((b) => b.source === "commitment").length;
  const completed = blocks.filter((b) => b.complete).length;
  const inProgress = blocks.filter((b) => b.inProgress).length;
  const totalMinutes = blocks.reduce((s, b) => s + b.durationMin, 0);
  const focusMinutes = 0;
  return { total, routine, commitment, completed, inProgress, totalMinutes, focusMinutes };
}
