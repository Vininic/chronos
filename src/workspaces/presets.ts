import type { WorkspaceStructure, TreeNode } from "@/lib/schedule/types";

export interface WorkspacePreset {
  id: string;
  label: string;
  description: string;
  icon: string;
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
          { name: "Cable Fly", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 45 } }, { name: "Set 3", fields: { instruction: "10 reps", restMin: 60 } }] },
          { name: "Push Up", children: [{ name: "Set 1", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "15 reps", restMin: 45 } }] },
          { name: "Dumbbell Pullover", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 60 } }] },
        ],
      },
      {
        name: "Back",
        children: [
          { name: "Pull Up", children: [{ name: "Set 1", fields: { instruction: "AMRAP", restMin: 90 } }, { name: "Set 2", fields: { instruction: "AMRAP", restMin: 90 } }, { name: "Set 3", fields: { instruction: "AMRAP", restMin: 90 } }] },
          { name: "Barbell Row", children: [{ name: "Set 1", fields: { instruction: "8 reps", restMin: 90 } }, { name: "Set 2", fields: { instruction: "8 reps", restMin: 90 } }, { name: "Set 3", fields: { instruction: "8 reps", restMin: 90 } }, { name: "Set 4", fields: { instruction: "6 reps", restMin: 120 } }] },
          { name: "Seated Cable Row", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 3", fields: { instruction: "10 reps", restMin: 60 } }] },
          { name: "Face Pull", children: [{ name: "Set 1", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "15 reps", restMin: 45 } }] },
          { name: "Lat Pulldown", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 60 } }, { name: "Set 3", fields: { instruction: "8 reps", restMin: 90 } }] },
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
          { name: "Leg Extension", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 3", fields: { instruction: "10 reps", restMin: 60 } }] },
          { name: "Walking Lunge", children: [{ name: "Set 1", fields: { instruction: "10 reps/leg", restMin: 60 } }, { name: "Set 2", fields: { instruction: "10 reps/leg", restMin: 60 } }] },
          { name: "Bulgarian Split Squat", children: [{ name: "Set 1", fields: { instruction: "8 reps/leg", restMin: 90 } }, { name: "Set 2", fields: { instruction: "8 reps/leg", restMin: 90 } }] },
          { name: "Box Jump", children: [{ name: "Set 1", fields: { instruction: "5 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "5 reps", restMin: 60 } }, { name: "Set 3", fields: { instruction: "5 reps", restMin: 60 } }] },
        ],
      },
      {
        name: "Hamstrings",
        children: [
          { name: "Romanian Deadlift", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 90 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 90 } }, { name: "Set 3", fields: { instruction: "8 reps", restMin: 120 } }] },
          { name: "Leg Curl", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 60 } }] },
          { name: "Glute Bridge", children: [{ name: "Set 1", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 3", fields: { instruction: "12 reps", restMin: 60 } }] },
          { name: "Hip Thrust", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 90 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 90 } }] },
          { name: "Calf Raise", children: [{ name: "Set 1", fields: { instruction: "15 reps", restMin: 30 } }, { name: "Set 2", fields: { instruction: "15 reps", restMin: 30 } }, { name: "Set 3", fields: { instruction: "12 reps", restMin: 30 } }] },
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
          { name: "Lateral Raise", children: [{ name: "Set 1", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 3", fields: { instruction: "12 reps", restMin: 45 } }, { name: "Set 4", fields: { instruction: "12 reps", restMin: 45 } }] },
          { name: "Front Raise", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 45 } }] },
          { name: "Reverse Fly", children: [{ name: "Set 1", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "15 reps", restMin: 45 } }, { name: "Set 3", fields: { instruction: "12 reps", restMin: 45 } }] },
          { name: "Arnold Press", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 60 } }] },
        ],
      },
      {
        name: "Arms",
        children: [
          { name: "Barbell Curl", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 60 } }, { name: "Set 3", fields: { instruction: "8 reps", restMin: 60 } }] },
          { name: "Triceps Pushdown", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 60 } }, { name: "Set 3", fields: { instruction: "10 reps", restMin: 60 } }] },
          { name: "Hammer Curl", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 45 } }] },
          { name: "Skull Crusher", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 60 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 60 } }] },
          { name: "Preacher Curl", children: [{ name: "Set 1", fields: { instruction: "12 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "12 reps", restMin: 45 } }, { name: "Set 3", fields: { instruction: "10 reps", restMin: 60 } }] },
        ],
      },
    ],
  },
  {
    name: "Lower B",
    children: [
      {
        name: "Glutes",
        children: [
          { name: "Deadlift", children: [{ name: "Set 1", fields: { instruction: "5 reps", restMin: 150 } }, { name: "Set 2", fields: { instruction: "5 reps", restMin: 150 } }, { name: "Set 3", fields: { instruction: "3 reps", restMin: 180 } }] },
          { name: "Hip Thrust", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 90 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 90 } }, { name: "Set 3", fields: { instruction: "8 reps", restMin: 120 } }] },
          { name: "Step Up", children: [{ name: "Set 1", fields: { instruction: "8 reps/leg", restMin: 60 } }, { name: "Set 2", fields: { instruction: "8 reps/leg", restMin: 60 } }] },
          { name: "Cable Kickback", children: [{ name: "Set 1", fields: { instruction: "15 reps/leg", restMin: 45 } }, { name: "Set 2", fields: { instruction: "15 reps/leg", restMin: 45 } }, { name: "Set 3", fields: { instruction: "12 reps/leg", restMin: 45 } }] },
          { name: "Nordic Curl", children: [{ name: "Set 1", fields: { instruction: "6 reps", restMin: 90 } }, { name: "Set 2", fields: { instruction: "6 reps", restMin: 90 } }] },
        ],
      },
      {
        name: "Calves & Core",
        children: [
          { name: "Standing Calf Raise", children: [{ name: "Set 1", fields: { instruction: "15 reps", restMin: 30 } }, { name: "Set 2", fields: { instruction: "15 reps", restMin: 30 } }, { name: "Set 3", fields: { instruction: "12 reps", restMin: 30 } }, { name: "Set 4", fields: { instruction: "12 reps", restMin: 30 } }] },
          { name: "Seated Calf Raise", children: [{ name: "Set 1", fields: { instruction: "15 reps", restMin: 30 } }, { name: "Set 2", fields: { instruction: "15 reps", restMin: 30 } }] },
          { name: "Plank", children: [{ name: "Set 1", fields: { instruction: "60 sec", restMin: 45 } }, { name: "Set 2", fields: { instruction: "60 sec", restMin: 45 } }] },
          { name: "Hanging Leg Raise", children: [{ name: "Set 1", fields: { instruction: "10 reps", restMin: 45 } }, { name: "Set 2", fields: { instruction: "10 reps", restMin: 45 } }, { name: "Set 3", fields: { instruction: "8 reps", restMin: 45 } }] },
          { name: "Russian Twist", children: [{ name: "Set 1", fields: { instruction: "20 reps", restMin: 30 } }, { name: "Set 2", fields: { instruction: "20 reps", restMin: 30 } }, { name: "Set 3", fields: { instruction: "15 reps", restMin: 30 } }] },
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
    rotation: { "0": "Upper A", "1": "Lower A", "2": "Upper B", "3": "Lower B", "4": "Upper A", "5": "Lower A", "6": "Upper B" },
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
  {
    name: "Next Book",
    children: [
      { name: "Session 1", fields: { pagesRead: 0 } },
      { name: "Session 2", fields: { pagesRead: 0 } },
    ],
  },
  {
    name: "Reference",
    children: [
      { name: "Chapter Review", fields: { pagesRead: 0 } },
      { name: "Note Taking", fields: { pagesRead: 0 } },
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
      { name: "Derivative Drills", fields: {} },
      { name: "Series Problems", fields: {} },
    ],
  },
  {
    name: "Linear Algebra",
    children: [
      { name: "Matrix Operations", fields: {} },
      { name: "Proof Practice", fields: {} },
      { name: "Eigenvalue Problems", fields: {} },
      { name: "Vector Spaces", fields: {} },
      { name: "Diagonalization", fields: {} },
    ],
  },
  {
    name: "Physics",
    children: [
      { name: "Mechanics Review", fields: {} },
      { name: "Thermodynamics", fields: {} },
      { name: "Electromagnetism", fields: {} },
      { name: "Problem Set", fields: {} },
      { name: "Lab Report", fields: {} },
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

/* ─── Project Preset ─── */

const projectTemplates: TreeNode[] = [
  {
    name: "Website Redesign",
    children: [
      {
        name: "Research",
        children: [
          { name: "Competitor Analysis", fields: {} },
          { name: "User Interviews", fields: {} },
          { name: "Information Architecture", fields: {} },
          { name: "Tech Stack Evaluation", fields: {} },
          { name: "Stakeholder Requirements", fields: {} },
        ],
      },
      {
        name: "Design",
        children: [
          { name: "Wireframes", fields: {} },
          { name: "High-fidelity Mockups", fields: {} },
          { name: "Design System Setup", fields: {} },
          { name: "Prototype", fields: {} },
          { name: "User Testing", fields: {} },
        ],
      },
      {
        name: "Development",
        children: [
          { name: "Frontend Implementation", fields: {} },
          { name: "Backend API", fields: {} },
          { name: "Database Schema", fields: {} },
          { name: "Integration Tests", fields: {} },
          { name: "Deployment Pipeline", fields: {} },
        ],
      },
      {
        name: "Launch",
        children: [
          { name: "QA Pass", fields: {} },
          { name: "Content Migration", fields: {} },
          { name: "DNS & SSL Setup", fields: {} },
          { name: "Beta Release", fields: {} },
          { name: "Production Launch", fields: {} },
        ],
      },
    ],
  },
  {
    name: "Mobile App",
    children: [
      {
        name: "Planning",
        children: [
          { name: "Feature Spec", fields: {} },
          { name: "User Stories", fields: {} },
          { name: "Sprint 0 Setup", fields: {} },
          { name: "Architecture Decision", fields: {} },
          { name: "API Contract", fields: {} },
        ],
      },
      {
        name: "Sprint 1",
        children: [
          { name: "Authentication", fields: {} },
          { name: "Navigation Shell", fields: {} },
          { name: "Onboarding Flow", fields: {} },
          { name: "Data Layer", fields: {} },
          { name: "Push Notifications", fields: {} },
        ],
      },
      {
        name: "Sprint 2",
        children: [
          { name: "Main Feature UI", fields: {} },
          { name: "Search & Filter", fields: {} },
          { name: "Offline Support", fields: {} },
          { name: "Error Handling", fields: {} },
          { name: "Performance Tuning", fields: {} },
        ],
      },
      {
        name: "Release",
        children: [
          { name: "App Store Assets", fields: {} },
          { name: "Beta Testing", fields: {} },
          { name: "Bug Bash", fields: {} },
          { name: "Store Submission", fields: {} },
          { name: "Post-launch Monitoring", fields: {} },
        ],
      },
    ],
  },
  {
    name: "Data Pipeline",
    children: [
      {
        name: "Ingestion",
        children: [
          { name: "Source Connectors", fields: {} },
          { name: "Schema Validation", fields: {} },
          { name: "Batch Processing", fields: {} },
          { name: "Real-time Stream", fields: {} },
          { name: "Data Lake Setup", fields: {} },
        ],
      },
      {
        name: "Transformation",
        children: [
          { name: "ETL Jobs", fields: {} },
          { name: "Data Quality Checks", fields: {} },
          { name: "Aggregation Logic", fields: {} },
          { name: "Feature Engineering", fields: {} },
          { name: "Audit Trail", fields: {} },
        ],
      },
      {
        name: "Analytics",
        children: [
          { name: "Dashboard Build", fields: {} },
          { name: "Report Generation", fields: {} },
          { name: "Alert Rules", fields: {} },
          { name: "A/B Testing Framework", fields: {} },
          { name: "Cost Optimization", fields: {} },
        ],
      },
    ],
  },
];

function createProject(): WorkspaceStructure {
  return {
    preset: "Project Tracker",
    levels: [
      { key: "phase", label: "Phase", labelPlural: "Phases", fields: [{ name: "name", label: "Name", type: "text" }] },
      { key: "task", label: "Task", labelPlural: "Tasks", fields: [{ name: "name", label: "Name", type: "text" }], tracking: { type: "boolean", default: false, label: "Done" } },
    ],
    display: { summary: "{active} · {done}/{total} tasks", nextStep: "{name}", progress: "boolean" },
    templates: clone(projectTemplates),
  };
}

/* ─── Deep Work Preset ─── */

const deepWorkTemplates: TreeNode[] = [
  {
    name: "Morning Focus",
    children: [
      {
        name: "Writing",
        children: [
          { name: "Draft Blog Post", fields: {} },
          { name: "Edit Newsletter", fields: {} },
          { name: "Outline Proposal", fields: {} },
          { name: "Technical Documentation", fields: {} },
          { name: "Code Comments Review", fields: {} },
        ],
      },
      {
        name: "Coding",
        children: [
          { name: "Feature Implementation", fields: {} },
          { name: "Refactor Module", fields: {} },
          { name: "Code Review PRs", fields: {} },
          { name: "Performance Optimization", fields: {} },
          { name: "Unit Tests", fields: {} },
        ],
      },
    ],
  },
  {
    name: "Afternoon Session",
    children: [
      {
        name: "Research",
        children: [
          { name: "Read Papers", fields: {} },
          { name: "Experiment Setup", fields: {} },
          { name: "Data Collection", fields: {} },
          { name: "Literature Review", fields: {} },
          { name: "Hypothesis Testing", fields: {} },
        ],
      },
      {
        name: "Planning",
        children: [
          { name: "Sprint Planning", fields: {} },
          { name: "Task Breakdown", fields: {} },
          { name: "Resource Estimation", fields: {} },
          { name: "Risk Assessment", fields: {} },
          { name: "OKR Review", fields: {} },
        ],
      },
    ],
  },
  {
    name: "Evening Review",
    children: [
      {
        name: "Reflection",
        children: [
          { name: "Daily Log", fields: {} },
          { name: "Progress Summary", fields: {} },
          { name: "Blockers Log", fields: {} },
          { name: "Tomorrow Prep", fields: {} },
          { name: "Learning Note", fields: {} },
        ],
      },
      {
        name: "Learning",
        children: [
          { name: "Course Module", fields: {} },
          { name: "Book Chapter", fields: {} },
          { name: "Tutorial Follow-along", fields: {} },
          { name: "Practice Exercise", fields: {} },
          { name: "Quiz Review", fields: {} },
        ],
      },
    ],
  },
];

function createDeepWork(): WorkspaceStructure {
  return {
    preset: "Deep Work Session",
    levels: [
      { key: "domain", label: "Domain", labelPlural: "Domains", fields: [{ name: "name", label: "Name", type: "text" }] },
      { key: "block", label: "Block", labelPlural: "Blocks", fields: [{ name: "name", label: "Name", type: "text" }], tracking: { type: "boolean", default: false, label: "Done" } },
    ],
    display: { summary: "{active} · {done}/{total} blocks", nextStep: "{name}", progress: "boolean" },
    templates: clone(deepWorkTemplates),
  };
}

/* ─── Checklist Preset ─── */

const checklistTemplates: TreeNode[] = [
  {
    name: "Daily Routine",
    children: [
      { name: "Morning Routine", children: [{ name: "Wake Up", fields: {} }, { name: "Meditate", fields: {} }, { name: "Exercise", fields: {} }, { name: "Shower", fields: {} }, { name: "Breakfast", fields: {} }, { name: "Plan Day", fields: {} }, { name: "Review Goals", fields: {} }] },
      { name: "Work Block", children: [{ name: "Check Email", fields: {} }, { name: "Top Priority Task", fields: {} }, { name: "Second Priority", fields: {} }, { name: "Standup Meeting", fields: {} }, { name: "Break", fields: {} }] },
      { name: "Evening", children: [{ name: "Review Day", fields: {} }, { name: "Plan Tomorrow", fields: {} }, { name: "Read", fields: {} }, { name: "Wind Down", fields: {} }, { name: "Sleep Prep", fields: {} }] },
    ],
  },
  {
    name: "Weekly Review",
    children: [
      { name: "Work", children: [{ name: "Review Completed Tasks", fields: {} }, { name: "Update Project Status", fields: {} }, { name: "Clear Pending Items", fields: {} }, { name: "Prepare Next Week", fields: {} }, { name: "Clean Inbox", fields: {} }] },
      { name: "Personal", children: [{ name: "Budget Review", fields: {} }, { name: "Meal Prep", fields: {} }, { name: "Appointments", fields: {} }, { name: "Home Tasks", fields: {} }, { name: "Social Check-in", fields: {} }] },
      { name: "Growth", children: [{ name: "Course Progress", fields: {} }, { name: "Read Articles", fields: {} }, { name: "Skill Practice", fields: {} }, { name: "Journal", fields: {} }, { name: "Goal Check-in", fields: {} }] },
    ],
  },
  {
    name: "Monthly Goals",
    children: [
      { name: "Career", children: [{ name: "Complete Certification", fields: {} }, { name: "Network Event", fields: {} }, { name: "Update Portfolio", fields: {} }, { name: "Mentor Session", fields: {} }, { name: "Read Industry Book", fields: {} }] },
      { name: "Health", children: [{ name: "Consistent Workouts", fields: {} }, { name: "Sleep Schedule", fields: {} }, { name: "Nutrition Plan", fields: {} }, { name: "Doctor Checkup", fields: {} }, { name: "Stress Management", fields: {} }] },
      { name: "Finance", children: [{ name: "Review Investments", fields: {} }, { name: "Update Budget", fields: {} }, { name: "Savings Goal", fields: {} }, { name: "Tax Prep", fields: {} }, { name: "Side Project Revenue", fields: {} }] },
    ],
  },
];

function createChecklist(): WorkspaceStructure {
  return {
    preset: "Checklist",
    levels: [
      { key: "category", label: "Category", labelPlural: "Categories", fields: [{ name: "name", label: "Name", type: "text" }] },
      { key: "item", label: "Item", labelPlural: "Items", fields: [{ name: "name", label: "Name", type: "text" }], tracking: { type: "boolean", default: false, label: "Done" } },
    ],
    display: { summary: "{active} · {done}/{total}", nextStep: "{name}", progress: "boolean" },
    templates: clone(checklistTemplates),
  };
}

/* ─── Registry ─── */

export const WORKSPACE_PRESETS: WorkspacePreset[] = [
  { id: "workout", label: "Workout", description: "Multi-template workout tracking with muscle groups, exercises, and sets", icon: "💪", create: createWorkout },
  { id: "reading", label: "Reading", description: "Book reading tracker with per-session page counts", icon: "📖", create: createReading },
  { id: "study", label: "Study", description: "Subject and activity tracking with completion checkboxes", icon: "🎓", create: createStudy },
  { id: "project", label: "Project", description: "Phase and task tracking for project management", icon: "📋", create: createProject },
  { id: "deep-work", label: "Deep Work", description: "Focused deep work sessions with domain and block tracking", icon: "🧠", create: createDeepWork },
  { id: "checklist", label: "Checklist", description: "Reusable checklists for daily, weekly, and monthly routines", icon: "✅", create: createChecklist },
];

export function getPreset(id: string): WorkspacePreset | undefined {
  return WORKSPACE_PRESETS.find((p) => p.id === id);
}
