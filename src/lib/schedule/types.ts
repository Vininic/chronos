export type BlockKind = "deep" | "meeting" | "ritual" | "recovery" | "shallow" | "sleep";

export interface Category {
  id: BlockKind;
  label: string;
  labelCustom?: string;
  tone: string;
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
  date: string; // YYYY-MM-DD
  start: string;
  end: string;
  endDate?: string; // optional explicit end date for cross-day commitments
  endsNextDay?: boolean; // convenience flag when endDate is omitted
  kind: BlockKind;
  title: string;
  titleCustom?: string;
  notes?: string;
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
  suggestions: Suggestion[];
  ledger: {
    compositionScore: number;
    metrics: { label: string; value: number }[];
    deepHours: number[];
    recoveryHours: number[];
  };
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_LABELS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

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
