import type { PlannerPreferences, PlannerProposal } from "./types";
import type { ScheduleData, RoutineBlock, Category } from "@/lib/schedule/types";
import type { LearningProfile } from "@/lib/ai/learning/types";
import { SCHEDULE_TEMPLATES } from "@/lib/schedule/templates";
import { DAY_LABELS, durationMin } from "@/lib/schedule/types";

export const DEFAULT_PREFERENCES: PlannerPreferences = {
  workMode: "remote",
  workHoursStart: "09:00",
  workHoursEnd: "17:00",
  focusPreference: "balanced",
  recoveryPriority: "medium",
  weeklyCategories: [],
  sleepStart: "22:30",
  sleepEnd: "07:00",
};

function baseCategories(): Category[] {
  return [
    { id: "deep", label: "Deep work", tone: "bronze", description: "Uninterrupted high-cognition work." },
    { id: "meeting", label: "Meeting", tone: "midnight", description: "Synchronous collaboration." },
    { id: "ritual", label: "Ritual", tone: "primary-glow", description: "Recurring personal practice." },
    { id: "recovery", label: "Recovery", tone: "emerald", description: "Active rest, walks, breath." },
    { id: "shallow", label: "Shallow", tone: "neutral", description: "Email, admin, low-cost tasks." },
    { id: "sleep", label: "Sleep", tone: "indigo", description: "Protected rest window." },
  ];
}

const TONE_POOL = ["bronze", "sky", "violet", "lime", "peach", "slate", "amber", "mint", "coral", "emerald", "indigo", "rose"];

// Deterministic tone/label from a category id — no hardcoded per-category map.
function toneForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i) | 0;
  return TONE_POOL[Math.abs(hash) % TONE_POOL.length];
}

function labelForId(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " ");
}

interface Archetype {
  name: string;
  description: string;
  workload: "light" | "moderate" | "intense";
  focusRatio: number;
  recoveryRatio: number;
  baseTemplateId: string;
  extraCategories: string[];
  focusCategoryIds: string[];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Shift all non-sleep blocks by the delta between template workday start and user's start.
// Drops any block that would fall outside the user's awake window after shifting.
function shiftBlocksToWorkWindow(
  blocks: RoutineBlock[],
  templateStart: string,
  userStart: string,
  sleepEnd: string,
  sleepStart: string,
): RoutineBlock[] {
  const shiftMin = timeToMinutes(userStart) - timeToMinutes(templateStart);
  if (shiftMin === 0) return blocks;
  const wakeMin = timeToMinutes(sleepEnd);
  const sleepMin = timeToMinutes(sleepStart);
  return blocks.reduce<RoutineBlock[]>((acc, b) => {
    const newStart = timeToMinutes(b.start) + shiftMin;
    const newEnd = timeToMinutes(b.end) + shiftMin;
    if (newStart >= wakeMin && newEnd <= sleepMin) {
      acc.push({ ...b, start: minutesToTime(newStart), end: minutesToTime(newEnd) });
    }
    return acc;
  }, []);
}

function weekMinutes(start: string, end: string): number {
  return durationMin(start, end) * 5;
}

const archetypeFactory = {
  productivityMax: (prefs: PlannerPreferences): Archetype => {
    const isDeepFocused = prefs.focusPreference === "deep-work";
    const ratio = isDeepFocused ? 0.75 : 0.65;
    const recoveryRatio = prefs.recoveryPriority === "high" ? 0.2 : 0.1;
    return {
      name: "Productivity Max",
      description: "Heavy focus blocks with minimal recovery. Designed for maximum output during work hours.",
      workload: "intense",
      focusRatio: ratio,
      recoveryRatio,
      baseTemplateId: "productivity",
      extraCategories: ["admin"],
      focusCategoryIds: ["deep"],
    };
  },
  balancedFlow: (prefs: PlannerPreferences): Archetype => {
    const focusRatio = prefs.focusPreference === "deep-work" ? 0.55 : prefs.focusPreference === "varied" ? 0.4 : 0.5;
    const recoveryRatio = prefs.recoveryPriority === "high" ? 0.35 : prefs.recoveryPriority === "low" ? 0.2 : 0.28;
    return {
      name: "Balanced Flow",
      description: "Even mix of focus, study, and recovery. Sustainable rhythm for long-term growth.",
      workload: "moderate",
      focusRatio,
      recoveryRatio,
      baseTemplateId: "balanced",
      extraCategories: ["study", "creative"],
      focusCategoryIds: ["deep", "study"],
    };
  },
  recoveryFirst: (prefs: PlannerPreferences): Archetype => {
    const focusRatio = prefs.focusPreference === "deep-work" ? 0.4 : 0.3;
    const recoveryRatio = prefs.recoveryPriority === "high" ? 0.5 : prefs.recoveryPriority === "medium" ? 0.4 : 0.3;
    return {
      name: "Recovery First",
      description: "More recovery blocks with shorter focus sessions. Emphasizes well-being and sustainability.",
      workload: "light",
      focusRatio,
      recoveryRatio,
      baseTemplateId: "recovery",
      extraCategories: ["exercise", "social"],
      focusCategoryIds: [],
    };
  },
  deepWorkSpecialist: (prefs: PlannerPreferences): Archetype => {
    const focusRatio = 0.8;
    const recoveryRatio = prefs.recoveryPriority === "high" ? 0.15 : 0.1;
    return {
      name: "Deep Work Specialist",
      description: "Long, uninterrupted focus blocks with deep work emphasis. Minimal meetings and admin.",
      workload: "intense",
      focusRatio,
      recoveryRatio,
      baseTemplateId: "deep-work",
      extraCategories: ["creative", "planning"],
      focusCategoryIds: ["deep"],
    };
  },
  studentRhythm: (prefs: PlannerPreferences): Archetype => {
    const focusRatio = prefs.focusPreference === "deep-work" ? 0.65 : 0.55;
    const recoveryRatio = prefs.recoveryPriority === "high" ? 0.25 : 0.18;
    return {
      name: "Student Rhythm",
      description: "Study-heavy schedule with review sessions and dedicated project time.",
      workload: "moderate",
      focusRatio,
      recoveryRatio,
      baseTemplateId: "student",
      extraCategories: ["study", "class", "review", "social"],
      focusCategoryIds: ["study", "class"],
    };
  },
};

function pickArchetypes(prefs: PlannerPreferences): Archetype[] {
  const result: Archetype[] = [];

  if (prefs.workMode === "student") {
    result.push(archetypeFactory.studentRhythm(prefs));
    result.push(archetypeFactory.balancedFlow(prefs));
    result.push(archetypeFactory.recoveryFirst(prefs));
    return result;
  }

  if (prefs.workMode === "freelance") {
    result.push(archetypeFactory.deepWorkSpecialist(prefs));
    result.push(archetypeFactory.balancedFlow(prefs));
    result.push(archetypeFactory.recoveryFirst(prefs));
    return result;
  }

  if (prefs.focusPreference === "deep-work") {
    result.push(archetypeFactory.productivityMax(prefs));
    result.push(archetypeFactory.deepWorkSpecialist(prefs));
    result.push(archetypeFactory.balancedFlow(prefs));
    if (prefs.recoveryPriority !== "low") {
      result.push(archetypeFactory.recoveryFirst(prefs));
    }
  } else if (prefs.focusPreference === "varied") {
    result.push(archetypeFactory.balancedFlow(prefs));
    result.push(archetypeFactory.recoveryFirst(prefs));
    result.push(archetypeFactory.studentRhythm(prefs));
    result.push(archetypeFactory.productivityMax(prefs));
  } else {
    result.push(archetypeFactory.balancedFlow(prefs));
    result.push(archetypeFactory.productivityMax(prefs));
    result.push(archetypeFactory.recoveryFirst(prefs));
    if (prefs.recoveryPriority === "low") {
      result.push(archetypeFactory.deepWorkSpecialist(prefs));
    }
  }

  if (prefs.workMode === "office") {
    result.push(archetypeFactory.productivityMax(prefs));
  } else if (prefs.workMode === "hybrid") {
    result.push(archetypeFactory.balancedFlow(prefs));
  }

  return [...new Map(result.map((a) => [a.name, a])).values()].slice(0, 5);
}

function buildScheduleData(archetype: Archetype, prefs: PlannerPreferences): ScheduleData {
  const template = SCHEDULE_TEMPLATES.find((t) => t.id === archetype.baseTemplateId);
  const base = template ? template.generate() : SCHEDULE_TEMPLATES[0].generate();

  const userCats: Category[] = prefs.weeklyCategories
    .filter((name) => name.trim().length > 0)
    .map((name) => {
      const id = name.toLowerCase().replace(/\s+/g, "-");
      return {
        id,
        label: name.trim(),
        tone: toneForId(id),
        description: `Custom category: ${name.trim()}.`,
      };
    });

  const extraFromArchetype: Category[] = archetype.extraCategories
    .filter((id) => !base.categories.some((c: Category) => c.id === id))
    .map((id) => ({
      id,
      label: labelForId(id),
      tone: toneForId(id),
      description: `${labelForId(id)} activities.`,
    }));

  const allCategories = [...base.categories, ...extraFromArchetype, ...userCats];

  // Sleep is structural (meta.sleepWindow) — never a routine block.
  const existingNonSleep = base.routine.filter((b: RoutineBlock) => b.kind !== "sleep");
  const templateWorkdayStart = base.meta.workdayStart ?? "07:00";
  const routine = shiftBlocksToWorkWindow(
    existingNonSleep,
    templateWorkdayStart,
    prefs.workHoursStart,
    prefs.sleepEnd,
    prefs.sleepStart,
  );

  const totalMinutes = archetype.focusRatio > 0 ? Math.round(weekMinutes(prefs.workHoursStart, prefs.workHoursEnd) * archetype.focusRatio) : 0;
  const estimatedFocusHours = Math.round(totalMinutes / 60);
  const totalRecoveryMinutes = archetype.recoveryRatio > 0 ? Math.round(weekMinutes(prefs.workHoursStart, prefs.workHoursEnd) * archetype.recoveryRatio) : 0;
  const estimatedRecoveryHours = Math.round(totalRecoveryMinutes / 60);

  const focusCategoryIds = archetype.focusCategoryIds;

  const scheduledHours: number[] = [];
  for (let d = 0; d < 7; d++) {
    const dayMinutes = routine
      .filter((b: RoutineBlock) => b.day === d)
      .reduce((sum: number, b: RoutineBlock) => sum + durationMin(b.start, b.end), 0);
    scheduledHours.push(Math.round(dayMinutes / 60 * 10) / 10);
  }

  return {
    ...base,
    meta: {
      ...base.meta,
      workdayStart: prefs.workHoursStart,
      workdayEnd: prefs.workHoursEnd,
      sleepWindow: { start: prefs.sleepStart, end: prefs.sleepEnd },
      focusCategoryIds,
    },
    categories: allCategories,
    routine,
    ledger: {
      ...base.ledger,
      scheduledHours,
    },
  };
}

function computePreview(archetype: Archetype, prefs: PlannerPreferences): PlannerProposal["preview"] {
  const weekMinutesTotal = weekMinutes(prefs.workHoursStart, prefs.workHoursEnd);
  const focusWeeklyMin = Math.round(weekMinutesTotal * archetype.focusRatio);
  const recoveryWeeklyMin = Math.round(weekMinutesTotal * archetype.recoveryRatio);
  const otherWeeklyMin = weekMinutesTotal - focusWeeklyMin - recoveryWeeklyMin;

  const focusPerDay = Math.round(focusWeeklyMin / 5);
  const recoveryPerDay = Math.round(recoveryWeeklyMin / 5);
  const otherPerDay = Math.round(otherWeeklyMin / 5);

  const weeklyBreakdown = DAY_LABELS.map((day, i) => {
    const isWeekend = i === 0 || i === 6;
    return {
      day,
      focus: isWeekend ? Math.round(focusPerDay * 0.3) : focusPerDay,
      recovery: isWeekend ? Math.round(recoveryPerDay * 1.5) : recoveryPerDay,
      other: isWeekend ? Math.round(otherPerDay * 0.3) : otherPerDay,
    };
  });

  const categoryDistribution: PlannerProposal["preview"]["categoryDistribution"] = [
    { name: "Focus", color: "bronze", hours: Math.round(focusWeeklyMin / 60) },
    { name: "Recovery", color: "emerald", hours: Math.round(recoveryWeeklyMin / 60) },
    { name: "Other", color: "neutral", hours: Math.round(otherWeeklyMin / 60) },
  ];

  const goalAlignment: PlannerProposal["preview"]["goalAlignment"] = [
    { goal: "Productivity", match: Math.round(archetype.focusRatio * 100) },
    { goal: "Well-being", match: Math.round(archetype.recoveryRatio * 100) },
    { goal: "Consistency", match: archetype.workload === "light" ? 85 : 70 },
  ];

  return { weeklyBreakdown, categoryDistribution, goalAlignment };
}

export function generateProposals(prefs: PlannerPreferences, profile?: LearningProfile): PlannerProposal[] {
  const archetypes = pickArchetypes(prefs);

  return archetypes.map((archetype, index) => {
    const categoryCount = archetype.extraCategories.length + 6 + prefs.weeklyCategories.filter((c) => c.trim()).length;
    const weekMins = weekMinutes(prefs.workHoursStart, prefs.workHoursEnd);
    let estimatedFocusHours = Math.round(weekMins * archetype.focusRatio / 60);
    let estimatedRecoveryHours = Math.round(weekMins * archetype.recoveryRatio / 60);
    const weeklyBlockCount = estimatedFocusHours + estimatedRecoveryHours + Math.round(weekMins * (1 - archetype.focusRatio - archetype.recoveryRatio) / 60);

    let finalFocusRatio = archetype.focusRatio;
    let finalRecoveryRatio = archetype.recoveryRatio;
    let description = archetype.description;

    if (profile) {
      const commonlyUsed = new Set(profile.commonlyUsedCategories);
      const userCats = prefs.weeklyCategories.filter((c) => c.trim());
      const boost = userCats.some((c) => commonlyUsed.has(c.toLowerCase().replace(/\s+/g, "-"))) ? 0.05 : 0;
      finalFocusRatio = Math.min(1, finalFocusRatio + boost);
      finalRecoveryRatio = Math.max(0, finalRecoveryRatio - boost * 0.5);

      if (profile.averageCompletionRate > 0.8) {
        finalFocusRatio = Math.min(1, finalFocusRatio + 0.03);
        finalRecoveryRatio = Math.max(0, finalRecoveryRatio - 0.03);
      } else if (profile.averageCompletionRate < 0.5) {
        finalFocusRatio = Math.max(0.2, finalFocusRatio - 0.03);
        finalRecoveryRatio = Math.min(0.6, finalRecoveryRatio + 0.03);
      }

      if (profile.neglectedGoalIds.length > 0) {
        description += ` · ${profile.neglectedGoalIds.length} neglected goal(s) to address`;
      }
    }

    estimatedFocusHours = Math.round(weekMins * finalFocusRatio / 60);
    estimatedRecoveryHours = Math.round(weekMins * finalRecoveryRatio / 60);

    const preview = computePreview(
      { ...archetype, focusRatio: finalFocusRatio, recoveryRatio: finalRecoveryRatio },
      prefs,
    );

    const goalAlignment = [...preview.goalAlignment];
    if (profile && profile.neglectedGoalIds.length > 0) {
      goalAlignment.push({ goal: "Neglected Goals", match: Math.round((1 - profile.neglectedGoalIds.length / Math.max(1, profile.goalCompletions.length)) * 100) });
    }

    const proposal: PlannerProposal = {
      id: `proposal-${index}`,
      name: archetype.name,
      description,
      workload: archetype.workload,
      focusRatio: finalFocusRatio,
      recoveryRatio: finalRecoveryRatio,
      categoryCount,
      weeklyBlockCount,
      estimatedFocusHours,
      estimatedRecoveryHours,
      generatedAt: new Date().toISOString(),
      generate: async () => buildScheduleData(archetype, prefs),
      preview: { ...preview, goalAlignment },
    };

    return proposal;
  });
}

export function personalizeProposal(proposal: PlannerProposal, profile: LearningProfile): PlannerProposal {
  let focusRatio = proposal.focusRatio;
  let recoveryRatio = proposal.recoveryRatio;

  if (profile.averageCompletionRate > 0.8 && focusRatio > recoveryRatio) {
    focusRatio = Math.min(1, focusRatio + 0.02);
    recoveryRatio = Math.max(0, recoveryRatio - 0.02);
  } else if (profile.averageCompletionRate < 0.5) {
    focusRatio = Math.max(0.2, focusRatio - 0.02);
    recoveryRatio = Math.min(0.6, recoveryRatio + 0.02);
  }

  const goalAlignment = [...proposal.preview.goalAlignment];
  if (profile.neglectedGoalIds.length > 0) {
    goalAlignment.push({ goal: "Neglected Goals", match: Math.round((1 - profile.neglectedGoalIds.length / Math.max(1, profile.goalCompletions.length)) * 100) });
  }

  const note = "• Personalized based on your habits";

  return {
    ...proposal,
    description: proposal.description + "\n" + note,
    focusRatio,
    recoveryRatio,
    preview: {
      ...proposal.preview,
      goalAlignment,
    },
  };
}
