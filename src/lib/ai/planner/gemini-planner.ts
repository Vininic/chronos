import type { PlannerPreferences, PlannerProposal } from "./types";
import type { ScheduleData, RoutineBlock, Category } from "@/lib/schedule/types";
import type { LearningProfile } from "@/lib/ai/learning/types";
import { DAY_LABELS, timeToMinutes } from "@/lib/schedule/types";
import { generateProposals } from "./generator";
import { loadProfile } from "@/lib/ai/learning/store";
import { resolveProvider } from "@/lib/ai/core/resolveProvider";

const TONES = [
  "bronze", "midnight", "primary-glow", "emerald", "neutral", "indigo",
  "sky", "violet", "coral", "mint", "peach", "amber", "slate", "lime", "rose",
] as const;

interface GeminiBlueprint {
  meta: {
    workdayStart: string;
    workdayEnd: string;
    sleepStart: string;
    sleepEnd: string;
    focusCategoryIds: string[];
  };
  categories: { id: string; label: string; tone: string }[];
  days: {
    day: number;
    blocks: { start: string; end: string; kind: string; title: string }[];
  }[];
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function computeLedger(schedule: ScheduleData) {
  const totalMin = schedule.routine.reduce((sum, b) => sum + durationMin(b), 0);
  const weeklyHours = Array.from({ length: 7 }, (_, d) => {
    const dayBlocks = schedule.routine.filter((b) => b.day === d && b.kind !== "sleep");
    return Math.round(dayBlocks.reduce((s, b) => s + durationMin(b), 0) / 60 * 10) / 10;
  });
  const focusIds = schedule.meta.focusCategoryIds ?? [];
  const focusMin = schedule.routine
    .filter((b) => focusIds.includes(b.kind))
    .reduce((s, b) => s + durationMin(b), 0);
  const recoveryMin = schedule.routine
    .filter((b) => b.kind === "recovery")
    .reduce((s, b) => s + durationMin(b), 0);
  const compositionScore = Math.min(100, Math.round((focusMin + recoveryMin) / Math.max(1, totalMin) * 100));
  return {
    compositionScore,
    metrics: [
      { label: "Load", value: Math.min(100, Math.round(totalMin / (7 * 12 * 60) * 100)) },
      { label: "Consistency", value: 70 },
      { label: "Variety", value: schedule.categories.length > 3 ? 60 : 40 },
      { label: "Focus", value: Math.min(100, Math.round(focusMin / Math.max(1, totalMin) * 100)) },
      { label: "Recovery", value: Math.min(100, Math.round(recoveryMin / Math.max(1, totalMin) * 100)) },
      { label: "Goals", value: 0 },
    ],
    scheduledHours: weeklyHours,
  };
}

function durationMin(b: { start: string; end: string }): number {
  const [sh, sm] = b.start.split(":").map(Number);
  const [eh, em] = b.end === "24:00" ? [24, 0] : b.end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

function blueprintToScheduleData(blueprint: GeminiBlueprint): ScheduleData {
  const categories: Category[] = blueprint.categories.map((c) => ({
    id: c.id,
    label: c.label,
    tone: c.tone,
    labelCustom: undefined,
    descriptionCustom: undefined,
    description: `${c.label} activities.`,
    workspace: undefined,
    color: undefined,
  }));

  const routine: RoutineBlock[] = [];

  for (const dayDef of blueprint.days) {
    const d = dayDef.day;
    for (const b of dayDef.blocks) {
      // Activities are never crossday. A block whose end is at/before its start
      // is malformed (LLM slip) — drop it rather than wrapping it past midnight.
      if (timeToMinutes(b.end) <= timeToMinutes(b.start)) continue;
      routine.push({
        id: uid("r"),
        day: d,
        start: b.start,
        end: b.end,
        kind: b.kind,
        title: b.title,
      });
    }
  }

  // Sleep is a structural concept derived from meta.sleepWindow (the agenda
  // builder renders it). It is never stored as routine blocks.

  const schedule: ScheduleData = {
    meta: {
      version: 5,
      owner: "You",
      cycle: { name: "general", number: 1, week: 1, progress: 0 },
      workdayStart: blueprint.meta.workdayStart,
      workdayEnd: blueprint.meta.workdayEnd,
      sleepWindow: { start: blueprint.meta.sleepStart, end: blueprint.meta.sleepEnd },
      enforceSleepBoundary: true,
      focusCategoryIds: blueprint.meta.focusCategoryIds,
    },
    categories,
    routine,
    commitments: [],
    presets: [],
    suggestions: [],
    goals: [],
    ledger: { compositionScore: 0, metrics: [], scheduledHours: [0, 0, 0, 0, 0, 0, 0] },
    progressSnapshots: [],
  };

  schedule.ledger = computeLedger(schedule);
  return schedule;
}

function summarizeLearningProfileLight(): string {
  try {
    const profile = loadProfile();
    if (!profile) return "";
    const prefs = profile.categoryPreferences;
    const top = prefs
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 3)
      .map((p) => `${p.categoryId} (${Math.round(p.completionRate * 100)}% completion)`)
      .join(", ");
    const windows = profile.productivityWindows;
    const peak = windows
      .slice()
      .sort((a, b) => b.averageFocusScore - a.averageFocusScore)
      .slice(0, 3)
      .map((w) => `${String(Math.floor(w.startMin / 60)).padStart(2, "0")}:00`)
      .join(", ");
    const parts: string[] = [];
    if (top) parts.push(`Best categories: ${top}`);
    if (peak) parts.push(`Peak hours: ${peak}`);
    return parts.join(".\n");
  } catch {
    return "";
  }
}

function buildGeminiPrompt(
  prefs: PlannerPreferences,
  learningSummary: string,
): string {
  const focusDescriptions: Record<string, string> = {
    "deep-work": "Long uninterrupted focus blocks (90-120 min). Minimal context switching.",
    "balanced": "Mix of focused blocks and varied tasks throughout the day.",
    "varied": "Shorter blocks (30-60 min) with frequent switches between different task types.",
  };
  const recoveryDescriptions: Record<string, string> = {
    low: "Minimal breaks between blocks. Maximize productive time.",
    medium: "Regular short breaks. One longer lunch break.",
    high: "Frequent breaks, longer recovery periods, and rest blocks after intense focus.",
  };
  const workModeDesc: Record<string, string> = {
    remote: "Works from home. No commute. Flexible environment.",
    hybrid: "Mix of home and office. Some commute days.",
    office: "Works from office. Fixed location, potential meetings.",
    student: "Student schedule with classes, study sessions, and flexible time.",
    freelance: "Self-employed. Full control over schedule but need client management.",
  };

  return `You are a personalized schedule designer. Create a weekly schedule based on the user's preferences.

## User Profile
- Work mode: ${prefs.workMode} — ${workModeDesc[prefs.workMode]}
- Work hours: ${prefs.workHoursStart} to ${prefs.workHoursEnd}
- Focus style: ${prefs.focusPreference} — ${focusDescriptions[prefs.focusPreference]}
- Recovery priority: ${prefs.recoveryPriority} — ${recoveryDescriptions[prefs.recoveryPriority]}
- Sleep: ${prefs.sleepStart} to ${prefs.sleepEnd}
- Custom categories requested: ${prefs.weeklyCategories.length > 0 ? prefs.weeklyCategories.join(", ") : "none (use defaults)"}
${learningSummary ? `\n## Learning Profile\n${learningSummary}` : ""}

## Requirements
1. Design 6-10 categories including these defaults: deep, meeting, ritual, recovery, shallow, sleep. Add custom ones as requested.
2. For each category, assign a unique tone from: ${TONES.join(", ")}
3. Create blocks for Monday through Friday (days 1-5). Days 0 (Sunday) and 6 (Saturday) should be lighter.
4. Follow the focus style: ${focusDescriptions[prefs.focusPreference]}
5. Follow the recovery priority: ${recoveryDescriptions[prefs.recoveryPriority]}
6. SLEEP BOUNDARY: The user is awake between ${prefs.sleepEnd} and ${prefs.sleepStart}. ALL blocks must start and end within this window. Never schedule blocks before ${prefs.sleepEnd} or after ${prefs.sleepStart}. Do NOT include sleep blocks in the days array — they are added automatically.
7. Each block must have a meaningful, human-readable title.
8. Core work blocks belong between ${prefs.workHoursStart} and ${prefs.workHoursEnd}.
9. Ritual and recovery blocks may appear just after wake (${prefs.sleepEnd}) or before sleep (${prefs.sleepStart}).
10. Block times must be valid HH:MM strings. End time must always be later than start time within the same day.

Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "meta": {
    "workdayStart": "${prefs.workHoursStart}",
    "workdayEnd": "${prefs.workHoursEnd}",
    "sleepStart": "${prefs.sleepStart}",
    "sleepEnd": "${prefs.sleepEnd}",
    "focusCategoryIds": ["deep"]
  },
  "categories": [
    { "id": "deep", "label": "Deep Work", "tone": "bronze" }
  ],
  "days": [
    {
      "day": 1,
      "blocks": [
        { "start": "07:00", "end": "07:30", "kind": "ritual", "title": "Morning routine" }
      ]
    }
  ]
}

Be creative and practical. Design a schedule that feels natural for this user's lifestyle.`;
}

function fallbackProposals(prefs: PlannerPreferences, learningProfile?: LearningProfile): PlannerProposal[] {
  return generateProposals(prefs, learningProfile);
}

function parseBlueprint(text: string): GeminiBlueprint | null {
  try {
    const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.meta || !parsed.categories || !parsed.days) return null;
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.days)) return null;
    if (parsed.categories.length < 3) return null;
    parsed.meta.workdayStart ??= "09:00";
    parsed.meta.workdayEnd ??= "17:00";
    parsed.meta.sleepStart ??= "22:30";
    parsed.meta.sleepEnd ??= "07:00";
    parsed.meta.focusCategoryIds ??= ["deep"];
    return parsed as GeminiBlueprint;
  } catch {
    return null;
  }
}

function createProposalFromBlueprint(blueprint: GeminiBlueprint, prefs: PlannerPreferences): PlannerProposal {
  const schedule = blueprintToScheduleData(blueprint);
  const totalBlocks = schedule.routine.filter((b) => b.kind !== "sleep").length;
  const focusIds = blueprint.meta.focusCategoryIds;
  const focusBlocks = schedule.routine.filter((b) => focusIds.includes(b.kind));
  const recoveryBlocks = schedule.routine.filter((b) => b.kind === "recovery");
  const focusHours = Math.round(focusBlocks.reduce((s, b) => s + durationMin(b), 0) / 60 * 10) / 10;
  const recoveryHours = Math.round(recoveryBlocks.reduce((s, b) => s + durationMin(b), 0) / 60 * 10) / 10;
  const totalHours = focusHours + recoveryHours + Math.round(
    schedule.routine.filter((b) => !focusIds.includes(b.kind) && b.kind !== "recovery" && b.kind !== "sleep")
      .reduce((s, b) => s + durationMin(b), 0) / 60 * 10,
  ) / 10;
  const focusRatio = totalHours > 0 ? focusHours / totalHours : 0.5;
  const recoveryRatio = totalHours > 0 ? recoveryHours / totalHours : 0.2;

  return {
    id: `gemini-${Date.now()}`,
    name: "AI Personalized Schedule",
    description: `Custom ${prefs.workMode} schedule designed for ${prefs.focusPreference} focus style with ${prefs.recoveryPriority} recovery priority.`,
    workload: prefs.recoveryPriority === "low" ? "intense" : prefs.recoveryPriority === "medium" ? "moderate" : "light",
    focusRatio,
    recoveryRatio,
    categoryCount: blueprint.categories.length,
    weeklyBlockCount: totalBlocks,
    estimatedFocusHours: focusHours,
    estimatedRecoveryHours: recoveryHours,
    generatedAt: new Date().toISOString(),
    generate: async () => schedule,
    preview: {
      weeklyBreakdown: Array.from({ length: 7 }, (_, d) => ({
        day: DAY_LABELS[d] ?? `Day ${d}`,
        focus: schedule.routine.filter((b) => b.day === d && focusIds.includes(b.kind)).reduce((s, b) => s + durationMin(b), 0) / 60,
        recovery: schedule.routine.filter((b) => b.day === d && b.kind === "recovery").reduce((s, b) => s + durationMin(b), 0) / 60,
        other: schedule.routine.filter((b) => b.day === d && !focusIds.includes(b.kind) && b.kind !== "recovery" && b.kind !== "sleep").reduce((s, b) => s + durationMin(b), 0) / 60,
      })),
      categoryDistribution: blueprint.categories.map((c) => ({
        name: c.label,
        color: c.tone,
        hours: schedule.routine.filter((b) => b.kind === c.id).reduce((s, b) => s + durationMin(b), 0) / 60,
      })),
      goalAlignment: [],
    },
  };
}

export async function generateGeminiProposals(
  prefs: PlannerPreferences,
  learningProfile?: LearningProfile,
): Promise<PlannerProposal[]> {
  const provider = resolveProvider();
  if (!provider) {
    return fallbackProposals(prefs, learningProfile);
  }

  try {
    const learningSummary = summarizeLearningProfileLight();
    const prompt = buildGeminiPrompt(prefs, learningSummary);

    const result = await provider.generateContent(prompt, {
      temperature: 0.7,
      maxTokens: 4096,
    });
    const blueprint = parseBlueprint(result.text);

    if (!blueprint) {
      return fallbackProposals(prefs, learningProfile);
    }

    const proposal = createProposalFromBlueprint(blueprint, prefs);
    return [proposal];
  } catch {
    return fallbackProposals(prefs, learningProfile);
  }
}
