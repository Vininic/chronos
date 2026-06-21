import type { ScheduleData, RoutineBlock, Category, Goal, SleepScheduleEntry } from "@/lib/schedule/types";

const CATEGORIES: Array<{ id: string; label: string; tone: string; description: string }> = [
  { id: "work", label: "Work", tone: "sky", description: "Professional work activities." },
  { id: "deep", label: "Deep Work", tone: "indigo", description: "Focused, uninterrupted work sessions." },
  { id: "meeting", label: "Meetings", tone: "amber", description: "Scheduled meetings and calls." },
  { id: "ritual", label: "Rituals", tone: "mint", description: "Daily habits and routines." },
  { id: "recovery", label: "Recovery", tone: "coral", description: "Rest and recovery activities." },
  { id: "shallow", label: "Admin", tone: "violet", description: "Light administrative tasks." },
  { id: "study", label: "Study", tone: "emerald", description: "Learning and study sessions." },
  { id: "creative", label: "Creative", tone: "peach", description: "Creative and brainstorming work." },
  { id: "class", label: "Classes", tone: "rose", description: "Scheduled classes and lectures." },
  { id: "admin", label: "Admin", tone: "lime", description: "General administrative tasks." },
];

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

interface WeekTemplate {
  day: number;
  blocks: Array<{
    start: string;
    end: string;
    kind: string;
    title: string;
  }>;
}

function generateWeekRoutine(): WeekTemplate[] {
  return [
    {
      day: 1,
      blocks: [
        { start: "07:00", end: "07:30", kind: "ritual", title: "Morning routine" },
        { start: "07:30", end: "08:00", kind: "shallow", title: "Email & planning" },
        { start: "08:00", end: "10:00", kind: "deep", title: "Deep work: Core project" },
        { start: "10:00", end: "10:15", kind: "recovery", title: "Break" },
        { start: "10:15", end: "11:30", kind: "work", title: "Feature implementation" },
        { start: "11:30", end: "12:00", kind: "meeting", title: "Daily standup" },
        { start: "12:00", end: "13:00", kind: "recovery", title: "Lunch" },
        { start: "13:00", end: "14:30", kind: "deep", title: "Deep work: Design" },
        { start: "14:30", end: "15:30", kind: "meeting", title: "Team sync" },
        { start: "15:30", end: "16:00", kind: "shallow", title: "Admin tasks" },
        { start: "16:00", end: "17:00", kind: "study", title: "Study: New framework" },
        { start: "17:00", end: "17:30", kind: "ritual", title: "Evening wind-down" },
      ],
    },
    {
      day: 2,
      blocks: [
        { start: "07:00", end: "07:30", kind: "ritual", title: "Morning routine" },
        { start: "07:30", end: "08:00", kind: "shallow", title: "Email & planning" },
        { start: "08:00", end: "10:30", kind: "deep", title: "Deep work: Architecture" },
        { start: "10:30", end: "10:45", kind: "recovery", title: "Break" },
        { start: "10:45", end: "12:00", kind: "work", title: "Implementation" },
        { start: "12:00", end: "13:00", kind: "recovery", title: "Lunch" },
        { start: "13:00", end: "14:00", kind: "meeting", title: "Client call" },
        { start: "14:00", end: "15:30", kind: "creative", title: "Brainstorming session" },
        { start: "15:30", end: "16:30", kind: "shallow", title: "Documentation" },
        { start: "16:30", end: "17:30", kind: "study", title: "Online course" },
      ],
    },
    {
      day: 3,
      blocks: [
        { start: "07:00", end: "07:30", kind: "ritual", title: "Morning routine" },
        { start: "07:30", end: "08:00", kind: "shallow", title: "Email & planning" },
        { start: "08:00", end: "09:30", kind: "deep", title: "Deep work: Code review" },
        { start: "09:30", end: "10:30", kind: "meeting", title: "Sprint planning" },
        { start: "10:30", end: "10:45", kind: "recovery", title: "Break" },
        { start: "10:45", end: "12:00", kind: "work", title: "Bug fixes" },
        { start: "12:00", end: "13:00", kind: "recovery", title: "Lunch" },
        { start: "13:00", end: "15:00", kind: "deep", title: "Deep work: Refactoring" },
        { start: "15:00", end: "16:00", kind: "meeting", title: "Review session" },
        { start: "16:00", end: "17:00", kind: "shallow", title: "Admin & reports" },
        { start: "17:00", end: "18:00", kind: "creative", title: "Side project" },
      ],
    },
    {
      day: 4,
      blocks: [
        { start: "07:00", end: "07:30", kind: "ritual", title: "Morning routine" },
        { start: "07:30", end: "08:00", kind: "shallow", title: "Email & planning" },
        { start: "08:00", end: "10:00", kind: "deep", title: "Deep work: Performance" },
        { start: "10:00", end: "10:15", kind: "recovery", title: "Break" },
        { start: "10:15", end: "11:00", kind: "meeting", title: "1:1 with manager" },
        { start: "11:00", end: "11:30", kind: "shallow", title: "Task management" },
        { start: "11:30", end: "12:00", kind: "study", title: "Research reading" },
        { start: "12:00", end: "13:00", kind: "recovery", title: "Lunch" },
        { start: "13:00", end: "14:30", kind: "work", title: "Feature development" },
        { start: "14:30", end: "15:30", kind: "class", title: "Team workshop" },
        { start: "15:30", end: "16:30", kind: "shallow", title: "Email & follow-ups" },
        { start: "16:30", end: "17:00", kind: "recovery", title: "Afternoon break" },
      ],
    },
    {
      day: 5,
      blocks: [
        { start: "07:30", end: "08:00", kind: "ritual", title: "Morning routine" },
        { start: "08:00", end: "08:30", kind: "shallow", title: "Weekly review" },
        { start: "08:30", end: "10:00", kind: "deep", title: "Deep work: Final touches" },
        { start: "10:00", end: "10:15", kind: "recovery", title: "Break" },
        { start: "10:15", end: "11:30", kind: "meeting", title: "Sprint retro" },
        { start: "11:30", end: "12:00", kind: "shallow", title: "Cleanup tasks" },
        { start: "12:00", end: "13:00", kind: "recovery", title: "Lunch" },
        { start: "13:00", end: "14:00", kind: "shallow", title: "Documentation" },
        { start: "14:00", end: "15:00", kind: "work", title: "Week wrap-up" },
        { start: "15:00", end: "16:00", kind: "creative", title: "Creative time" },
        { start: "16:00", end: "16:30", kind: "ritual", title: "Week wind-down" },
      ],
    },
    {
      day: 6,
      blocks: [
        { start: "08:00", end: "09:00", kind: "ritual", title: "Morning routine" },
        { start: "09:00", end: "10:00", kind: "study", title: "Learning: New topic" },
        { start: "10:00", end: "12:00", kind: "creative", title: "Personal project" },
        { start: "12:00", end: "13:00", kind: "recovery", title: "Lunch" },
        { start: "13:00", end: "15:00", kind: "recovery", title: "Free time" },
        { start: "15:00", end: "17:00", kind: "shallow", title: "Errands & chores" },
      ],
    },
    {
      day: 0,
      blocks: [
        { start: "09:00", end: "10:00", kind: "ritual", title: "Morning routine" },
        { start: "10:00", end: "12:00", kind: "recovery", title: "Rest & leisure" },
        { start: "12:00", end: "13:00", kind: "recovery", title: "Lunch" },
        { start: "13:00", end: "15:00", kind: "recovery", title: "Free time" },
        { start: "15:00", end: "17:00", kind: "shallow", title: "Weekly planning" },
      ],
    },
  ];
}

export interface GeneratedDemoData {
  schedule: ScheduleData;
  learningProfile: {
    totalDaysTracked: number;
    completionRate: number;
  };
}

export function generateDemoData(): GeneratedDemoData {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startDate = tomorrow.toISOString().slice(0, 10);

  const weekRoutine = generateWeekRoutine();
  const routine: RoutineBlock[] = weekRoutine.flatMap((day) =>
    day.blocks.map((b) => ({
      id: uid("r"),
      day: day.day,
      start: b.start,
      end: b.end,
      kind: b.kind,
      title: b.title,
      endsNextDay: b.end <= b.start,
    })),
  );

  const categories: Category[] = CATEGORIES.map((c) => ({
    id: c.id,
    label: c.label,
    tone: c.tone,
    description: c.description,
  }));

  const sleepSchedule: SleepScheduleEntry[] = [
    { start: "23:00", end: "07:00" },
  ];

  const goals: Goal[] = [
    {
      id: uid("goal"),
      kind: "duration",
      tracking: "category",
      title: "Focus: 25h deep work this week",
      categoryId: "deep",
      target: 1500,
      unit: "minutes",
      period: "weekly",
      weight: 3,
      blocks: [],
      subTasks: [],
      looseCommitmentIds: [],
      startDate: startDate,
      deadline: undefined,
      createdAt: new Date().toISOString(),
    },
    {
      id: uid("goal"),
      kind: "numeric",
      tracking: "quota",
      title: "Complete 5 study sessions",
      categoryId: "study",
      target: 5,
      unit: "sessions",
      period: "weekly",
      weight: 2,
      blocks: [],
      subTasks: [],
      looseCommitmentIds: [],
      startDate: startDate,
      deadline: undefined,
      createdAt: new Date().toISOString(),
    },
    {
      id: uid("goal"),
      kind: "deadline",
      tracking: "none",
      title: "Submit Q2 project report",
      target: 1,
      period: "total",
      weight: 3,
      deadline: new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10),
      blocks: [],
      subTasks: [
        { id: uid("gst"), title: "Draft outline", done: false },
        { id: uid("gst"), title: "Write introduction", done: false },
        { id: uid("gst"), title: "Compile results", done: false },
        { id: uid("gst"), title: "Review and submit", done: false },
      ],
      looseCommitmentIds: [],
      startDate: startDate,
      createdAt: new Date().toISOString(),
    },
  ];

  const schedule: ScheduleData = {
    meta: {
      version: 5,
      owner: "Demo User",
      cycle: { name: "Exploration", number: 3, week: 12, progress: 0 },
      workdayStart: "07:00",
      workdayEnd: "18:00",
      sleepWindow: { start: "23:00", end: "07:00" },
      sleepSchedule,
      enforceSleepBoundary: true,
      focusCategoryIds: ["deep", "work"],
    },
    categories,
    routine,
    commitments: [],
    presets: [],
    suggestions: [],
    goals,
    ledger: {
      compositionScore: 78,
      metrics: [
        { label: "Load", value: 72 },
        { label: "Consistency", value: 81 },
        { label: "Variety", value: 65 },
        { label: "Focus", value: 35 },
        { label: "Recovery", value: 18 },
        { label: "Goals", value: 42 },
      ],
      scheduledHours: [5, 8.5, 8.5, 8.5, 7.5, 6, 5].map((h, i) => {
        const d = (i + 1) % 7;
        return routine
          .filter((r) => r.day === d)
          .reduce((sum, r) => {
            const [sh, sm] = r.start.split(":").map(Number);
            const [eh, em] = r.end.split(":").map(Number);
            return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60;
          }, 0);
      }),
    },
    progressSnapshots: [],
  };

  return {
    schedule,
    learningProfile: {
      totalDaysTracked: 42,
      completionRate: 0.73,
    },
  };
}

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem("chronos.demo.active") === "true";
  } catch {
    return false;
  }
}

export function setDemoMode(active: boolean): void {
  try {
    if (active) {
      localStorage.setItem("chronos.demo.active", "true");
    } else {
      localStorage.removeItem("chronos.demo.active");
    }
  } catch {
    // ignore
  }
}

export function shouldShowDemoPrompt(): boolean {
  try {
    const hasSchedule = !!localStorage.getItem("chronos.schedule.v5");
    const hasV4 = !!localStorage.getItem("chronos.schedule.v4");
    const hasV3 = !!localStorage.getItem("chronos.schedule.v3");
    const isDemo = localStorage.getItem("chronos.demo.active") === "true";
    return !hasSchedule && !hasV4 && !hasV3 && !isDemo;
  } catch {
    return false;
  }
}

export function clearDemoData(): void {
  try {
    const keys = [
      "chronos.schedule.v5",
      "chronos.schedule.v4",
      "chronos.schedule.v3",
      "chronos.schedule.v2",
      "chronos.schedule.v1",
      "chronos.learning.v1",
      "chronos.demo.active",
    ];
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}
