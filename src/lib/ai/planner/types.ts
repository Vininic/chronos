import type { ScheduleData } from "@/lib/schedule/types";

export type WorkMode = "remote" | "hybrid" | "office" | "student" | "freelance";
export type FocusPreference = "deep-work" | "balanced" | "varied";
export type RecoveryPriority = "low" | "medium" | "high";

export interface PlannerPreferences {
  workMode: WorkMode;
  workHoursStart: string;
  workHoursEnd: string;
  focusPreference: FocusPreference;
  recoveryPriority: RecoveryPriority;
  weeklyCategories: string[];
  sleepStart: string;
  sleepEnd: string;
}

export interface PlannerProposal {
  id: string;
  name: string;
  description: string;
  workload: "light" | "moderate" | "intense";
  focusRatio: number;
  recoveryRatio: number;
  categoryCount: number;
  weeklyBlockCount: number;
  estimatedFocusHours: number;
  estimatedRecoveryHours: number;
  generatedAt: string;
  generate: () => Promise<ScheduleData>;
  preview: {
    weeklyBreakdown: { day: string; focus: number; recovery: number; other: number }[];
    categoryDistribution: { name: string; color: string; hours: number }[];
    goalAlignment: { goal: string; match: number }[];
  };
}
