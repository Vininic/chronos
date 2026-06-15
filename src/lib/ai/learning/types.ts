export interface CompletionRecord {
  blockId: string;
  categoryId: string;
  date: string;
  start: string;
  end: string;
  durationMin: number;
  completed: boolean;
  templateName?: string;
}

export interface DailyPattern {
  date: string;
  focusMinutes: number;
  recoveryMinutes: number;
  totalMinutes: number;
  categoryMinutes: Record<string, number>;
  completionRate: number;
  overloadScore: number;
}

export interface CategoryPreference {
  categoryId: string;
  preferredStartMin: number;
  startVariance: number;
  averageDurationMin: number;
  completionRate: number;
  totalSessions: number;
  preferredDays: number[];
}

export interface ProductivityWindow {
  dayOfWeek: number;
  startMin: number;
  endMin: number;
  averageFocusScore: number;
  sessionCount: number;
}

export interface GoalCompletionRecord {
  goalId: string;
  goalTitle: string;
  date: string;
  progressBefore: number;
  progressAfter: number;
  delta: number;
  categoryId?: string;
}

export interface LearningProfile {
  version: number;
  lastUpdated: string;
  totalDaysTracked: number;
  completions: CompletionRecord[];
  dailyPatterns: DailyPattern[];
  categoryPreferences: CategoryPreference[];
  productivityWindows: ProductivityWindow[];
  averageFocusMinutesPerDay: number;
  averageRecoveryMinutesPerDay: number;
  averageCompletionRate: number;
  preferredWorkStart: string;
  preferredWorkEnd: string;
  commonlyUsedCategories: string[];
  neglectedCategories: string[];
  goalCompletions: GoalCompletionRecord[];
  neglectedGoalIds: string[];
}

export const EMPTY_PROFILE: LearningProfile = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  totalDaysTracked: 0,
  completions: [],
  dailyPatterns: [],
  categoryPreferences: [],
  productivityWindows: [],
  averageFocusMinutesPerDay: 0,
  averageRecoveryMinutesPerDay: 0,
  averageCompletionRate: 0,
  preferredWorkStart: "07:00",
  preferredWorkEnd: "19:00",
  commonlyUsedCategories: [],
  neglectedCategories: [],
  goalCompletions: [],
  neglectedGoalIds: [],
};
