export type BlockKind = "deep" | "meeting" | "ritual" | "recovery" | "shallow";

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
  start: string; // "HH:MM"
  end: string;
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

export interface ScheduleData {
  meta: {
    version: number;
    owner: string;
    cycle: { name: string; number: number; week: number; progress: number };
    workdayStart: string;
    workdayEnd: string;
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
  return Math.max(0, timeToMinutes(end) - timeToMinutes(start));
}
export function fmtDur(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}