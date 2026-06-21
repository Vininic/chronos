import type { ScheduleData } from "@/lib/schedule/types";
import { generateGeminiProposals } from "./gemini-planner";
import type { PlannerPreferences } from "./types";
import type { LearningProfile } from "../learning/types";
import { loadProfile } from "../learning/store";

export async function regenerateDays(
  data: ScheduleData,
  days: number[],
  instructions: string,
): Promise<ScheduleData | null> {
  const daySet = new Set(days);

  const categoryLabels = data.categories.map((c) => c.label);
  const prefs: PlannerPreferences = {
    workMode: "remote",
    workHoursStart: data.meta.workdayStart ?? "09:00",
    workHoursEnd: data.meta.workdayEnd ?? "17:00",
    focusPreference: "balanced",
    recoveryPriority: "medium",
    weeklyCategories: categoryLabels,
    sleepStart: data.meta.sleepWindow?.start ?? "22:30",
    sleepEnd: data.meta.sleepWindow?.end ?? "07:00",
  };

  const learningProfile: LearningProfile | undefined = loadProfile();

  const proposals = await generateGeminiProposals(prefs, learningProfile);
  if (proposals.length === 0) return null;

  const generated = await proposals[0].generate();
  if (!generated) return null;

  // Merge: keep blocks from original for days NOT being regenerated,
  // use generated blocks for the specified days
  const merged: ScheduleData = {
    ...data,
    routine: [
      ...data.routine.filter((b) => !daySet.has(b.day)),
      ...generated.routine.filter((b) => daySet.has(b.day)),
    ],
    commitments: [
      ...data.commitments.filter((c) => !daySet.has(c.day)),
      ...generated.commitments.filter((c) => daySet.has(c.day)),
    ],
    categories: generated.categories.length > 0 ? generated.categories : data.categories,
  };

  return merged;
}
