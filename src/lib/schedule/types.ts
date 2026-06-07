export type BlockKind = string;
export const BUILTIN_KINDS = ["deep", "meeting", "ritual", "recovery", "shallow", "sleep"] as const;

export interface Category {
  id: BlockKind;
  label: string;
  labelCustom?: string;
  tone: string;
  color?: string; // hex color for dynamic block styling
  description: string;
  descriptionCustom?: string;
}

export interface RoutineBlock {
  id: string;
  day: number; // 0 Sun ... 6 Sat
  start: string;
  end: string;
  endsNextDay?: boolean;
  kind: BlockKind;
  title: string;
  titleCustom?: string;
  notes?: string;
}

export interface Commitment {
  id: string;
  date?: string; // YYYY-MM-DD — undefined means "undated" (pool)
  start: string;
  end: string;
  endDate?: string; // optional explicit end date for cross-day commitments
  endsNextDay?: boolean; // convenience flag when endDate is omitted
  kind: BlockKind;
  title: string;
  titleCustom?: string;
  notes?: string;
  priority?: CommitmentPriority;
}

export interface CommitmentPriority {
  urgent: boolean;
  important: boolean;
}

export interface Preset {
  id: string;
  title: string;
  titleCustom?: string;
  kind: BlockKind;
  duration: number; // minutes
  notes?: string;
  priority?: CommitmentPriority;
}

export interface Suggestion {
  id: string;
  title: string;
  detail: string;
  impact: string;
  priority: "high" | "med" | "low";
  patch?:
    | { type: "add-routine"; block: Omit<RoutineBlock, "id"> }
    | { type: "add-routines"; blocks: Omit<RoutineBlock, "id">[] }
    | { type: "remove-routine"; match: Partial<RoutineBlock> };
}

/** A sleep schedule entry — defines a sleep window, optionally for specific days of week.
 *  days: 0=Sun..6=Sat. Omitting days means it applies to all days.
 *  start/end crossing midnight (start > end) means the sleep spans into the next calendar day.
 *  Multiple entries are allowed; the first matching entry for a given day wins. */
export interface SleepScheduleEntry {
  start?: string;
  end?: string;
  days?: number[]; // 0=Sun..6=Sat; absent = all days
}

/** A per-date sleep cut: overrides the sleep schedule for a specific calendar date.
 *  Splits the day's timeline into two visible segments. */
export interface SleepCut {
  date: string;   // YYYY-MM-DD
  start: string;
  end: string;
}

export interface ScheduleData {
  meta: {
    version: number;
    owner: string;
    cycle: { name: string; number: number; week: number; progress: number };
    workdayStart: string;
    workdayEnd: string;
    /** Whether sleep window is enforced as a hard scheduling boundary */
    enforceSleepBoundary?: boolean;
    /** Which categories are treated as \"focus\" categories for the timer card/page */
    focusCategoryIds?: string[];
    /** Legacy single sleep window — migrated to sleepSchedule on load */
    sleepWindow?: { start: string; end: string };
    /** New: per-day-of-week sleep schedule, replaces sleepWindow */
    sleepSchedule?: SleepScheduleEntry[];
    /** Per-date overrides — splits the timeline mid-day */
    sleepCuts?: SleepCut[];
  };
  categories: Category[];
  routine: RoutineBlock[];
  commitments: Commitment[];
  presets: Preset[];
  suggestions: Suggestion[];
  ledger: {
    compositionScore: number;
    metrics: { label: string; value: number }[];
    scheduledHours: number[];
  };
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_LABELS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const SNAP = 15;

export function snapTime(min: number) {
  const s = Math.round(min / SNAP) * SNAP;
  if (s >= 24 * 60) return "24:00";
  const c = Math.max(0, Math.min(23 * 60 + 59, s));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
}

export function clockTimeFromMin(min: number) {
  const snapped = Math.round(min / SNAP) * SNAP;
  if (snapped >= 24 * 60) return "24:00";
  const day = 24 * 60;
  const wrapped = ((snapped % day) + day) % day;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function durationMin(start: string, end: string): number {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  if (endMin === startMin) return 24 * 60;
  if (endMin < startMin) return 24 * 60 - startMin + endMin;
  return Math.max(0, endMin - startMin);
}
export function fmtDur(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export type EisenhowerQuadrant = "do-first" | "schedule" | "delegate" | "eliminate";

export function eisenhowerQuadrant(p: CommitmentPriority | undefined | null): EisenhowerQuadrant {
  if (!p) return "eliminate";
  if (p.urgent && p.important) return "do-first";
  if (!p.urgent && p.important) return "schedule";
  if (p.urgent && !p.important) return "delegate";
  return "eliminate";
}

export function quadrantOrder(q: EisenhowerQuadrant): number {
  return q === "do-first" ? 0 : q === "schedule" ? 1 : q === "delegate" ? 2 : 3;
}

export const QUADRANT_COLORS: Record<EisenhowerQuadrant, string> = {
  "do-first": "bg-red-500",
  "schedule": "bg-blue-500",
  "delegate": "bg-amber-500",
  "eliminate": "bg-muted-foreground/30",
};

export const QUADRANT_TEXT_COLORS: Record<EisenhowerQuadrant, string> = {
  "do-first": "text-red-500",
  "schedule": "text-blue-500",
  "delegate": "text-amber-500",
  "eliminate": "text-muted-foreground/40",
};

export const QUADRANT_LABELS: Record<EisenhowerQuadrant, { pt: string; en: string }> = {
  "do-first": { pt: "Fazer", en: "Do First" },
  "schedule": { pt: "Agendar", en: "Schedule" },
  "delegate": { pt: "Delegar", en: "Delegate" },
  "eliminate": { pt: "Eliminar", en: "Eliminate" },
};
