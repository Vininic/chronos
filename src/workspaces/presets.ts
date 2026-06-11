import type { WorkspaceStructure, TreeNode } from "@/lib/schedule/types";

export interface WorkspacePreset {
  id: string;
  label: string;
  description: string;
  create: () => WorkspaceStructure;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/* ─── Workout Preset ─── */

const workoutTemplates: TreeNode[] = [
  {
    name: "Upper A",
    children: [
      {
        name: "Chest",
        children: [
          { name: "Bench Press", children: [{ name: "Set 1", fields: { instruction: "8 reps", restMin: 90 } }, { name: "Set 2", fields: { instruction: "8 reps", restMin: 90 } }, { name: "Set 3", fields: { instruction: "6 reps", restMin: 120 } }] },
          { name: "Incline Dumbbell", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 60 } }] },
        ],
      },
      {
        name: "Back",
        children: [
          { name: "Pull Up", children: [{ name: "Set 1", fields: { instruction: "AMRAP", restMin: 90 } }, { name: "Set 2", fields: { instruction: "AMRAP", restMin: 90 } }] },
          { name: "Barbell Row", children: [{ name: "Set 1", fields: { instruction: "8 reps", restMin: 90 } }, { name: "Set 2", fields: { instruction: "8 reps", restMin: 90 } }, { name: "Set 3", fields: { instruction: "8 reps", restMin: 90 } }] },
        ],
      },
    ],
  },
  {
    name: "Lower A",
    children: [
      {
        name: "Quads",
        children: [
          { name: "Squat", children: [{ name: "Set 1", fields: { instruction: "8 reps", restMin: 120 } }, { name: "Set 2", fields: { instruction: "8 reps", restMin: 120 } }, { name: "Set 3", fields: { instruction: "6 reps", restMin: 150 } }] },
          { name: "Leg Extension", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 60 } }] },
        ],
      },
      {
        name: "Hamstrings",
        children: [
          { name: "Romanian Deadlift", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 90 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 90 } }] },
        ],
      },
    ],
  },
  {
    name: "Upper B",
    children: [
      {
        name: "Shoulders",
        children: [
          { name: "OHP", children: [{ name: "Set 1", fields: { instruction: "8 reps", restMin: 90 } }, { name: "Set 2", fields: { instruction: "8 reps", restMin: 90 } }, { name: "Set 3", fields: { instruction: "6 reps", restMin: 120 } }] },
          { name: "Lateral Raise", children: [{ name: "Set 1", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 3", fields: { instruction: "12 reps", restMin: 45 } }] },
        ],
      },
      {
        name: "Arms",
        children: [
          { name: "Barbell Curl", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 60 } }] },
          { name: "Triceps Pushdown", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 60 } }] },
        ],
      },
    ],
  },
];

function createWorkout(): WorkspaceStructure {
  return {
    preset: "Workout Program",
    levels: [
      { key: "group", label: "Muscle Group", labelPlural: "Muscle Groups", fields: [{ name: "name", label: "Name", type: "text" }] },
      { key: "exercise", label: "Exercise", labelPlural: "Exercises", fields: [{ name: "name", label: "Name", type: "text" }] },
      { key: "set", label: "Set", labelPlural: "Sets", fields: [{ name: "instruction", label: "Instruction", type: "text" }, { name: "restMin", label: "Rest (min)", type: "number" }], tracking: { type: "boolean", default: false, label: "Done" } },
    ],
    display: { summary: "{active} · {done}/{total}", nextStep: "{instruction} · {restMin}min rest", progress: "boolean" },
    templates: clone(workoutTemplates),
    rotation: { "0": "Upper A", "1": "Lower A", "2": "Upper B", "3": "Lower A", "4": "Upper A", "5": "Upper B", "6": "Lower A" },
  };
}

/* ─── Reading Preset ─── */

const readingTemplates: TreeNode[] = [
  {
    name: "Current Book",
    children: [
      { name: "Session 1", fields: { pagesRead: 15 } },
      { name: "Session 2", fields: { pagesRead: 0 } },
      { name: "Session 3", fields: { pagesRead: 0 } },
    ],
  },
];

function createReading(): WorkspaceStructure {
  return {
    preset: "Reading Tracker",
    levels: [
      { key: "book", label: "Book", labelPlural: "Books", fields: [{ name: "name", label: "Name", type: "text" }] },
      { key: "session", label: "Session", labelPlural: "Sessions", fields: [{ name: "pagesRead", label: "Pages Read", type: "number" }], tracking: { type: "number", default: 0, label: "Read", targetField: "pagesRead" } },
    ],
    display: { summary: "{active} · {done}/{total} pages", nextStep: "Read {pagesRead} pages", progress: "number" },
    templates: clone(readingTemplates),
  };
}

/* ─── Study Preset ─── */

const studyTemplates: TreeNode[] = [
  {
    name: "Calculus",
    children: [
      { name: "Review Notes", fields: {} },
      { name: "Practice Integrals", fields: {} },
      { name: "Read Next Chapter", fields: {} },
    ],
  },
  {
    name: "Linear Algebra",
    children: [
      { name: "Matrix Operations", fields: {} },
      { name: "Proof Practice", fields: {} },
    ],
  },
];

function createStudy(): WorkspaceStructure {
  return {
    preset: "Study Session",
    levels: [
      { key: "subject", label: "Subject", labelPlural: "Subjects", fields: [{ name: "name", label: "Name", type: "text" }] },
      { key: "activity", label: "Activity", labelPlural: "Activities", fields: [{ name: "name", label: "Name", type: "text" }], tracking: { type: "boolean", default: false, label: "Done" } },
    ],
    display: { summary: "{active} · {done}/{total}", nextStep: "{name}", progress: "boolean" },
    templates: clone(studyTemplates),
  };
}

/* ─── Registry ─── */

export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  { id: "workout", label: "Workout", description: "Multi-template workout tracking with muscle groups, exercises, and sets", create: createWorkout },
  { id: "reading", label: "Reading", description: "Book reading tracker with per-session page counts", create: createReading },
  { id: "study", label: "Study", description: "Subject and activity tracking with completion checkboxes", create: createStudy },
];

export function getPreset(id: string): WorkspacePreset | undefined {
  return WORKSPACE_PRESETS.find((p) => p.id === id);
}
