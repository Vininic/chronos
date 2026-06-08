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
  extensionId?: string;
  extensionConfig?: Record<string, unknown>;
  customFields?: CustomField[];
}

export interface CustomField {
  name: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "checklist";
  options?: string[];
  defaultValue?: unknown;
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
  extensions?: Record<string, unknown>;
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
  extensions?: Record<string, unknown>;
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
  extensions?: Record<string, unknown>;
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

export type GoalKind = "duration" | "numeric" | "deadline";
// "count" was merged into "numeric" (v5→v6 migration); legacy values get normalized on load
export type GoalTracking = "category" | "goalBlock" | "quota" | "subTask" | "none";
export type GoalPeriod = "daily" | "weekly" | "monthly" | "total";
export type GoalAutoTrackMode = "always" | "selected" | "commitments";

export const GOAL_TRACKING_BY_KIND: Record<GoalKind, GoalTracking[]> = {
  numeric: ["goalBlock", "subTask", "category"],
  duration: ["quota", "category"],
  deadline: ["none", "goalBlock", "subTask", "category"],
};

export function getDefaultGoalTracking(kind: GoalKind): GoalTracking {
  return GOAL_TRACKING_BY_KIND[kind][0];
}

export function isGoalTrackingValid(kind: GoalKind, tracking: GoalTracking): boolean {
  return GOAL_TRACKING_BY_KIND[kind].includes(tracking);
}

export function getValidGoalPeriods(kind: GoalKind, tracking: GoalTracking): GoalPeriod[] {
  if (kind === "deadline" || tracking === "none" || tracking === "subTask") return ["total"];
  return ["daily", "weekly", "monthly", "total"];
}

export function getDefaultGoalPeriod(kind: GoalKind, tracking: GoalTracking): GoalPeriod {
  if (kind === "deadline" || tracking === "none" || tracking === "subTask") return "total";
  return kind === "duration" ? "weekly" : "daily";
}

export function isGoalPeriodValid(kind: GoalKind, tracking: GoalTracking, period: GoalPeriod): boolean {
  return getValidGoalPeriods(kind, tracking).includes(period);
}

export interface GoalBlock {
  id: string;
  goalId: string;
  title: string;
  duration: number;
  date: string;
  time?: string;
  done: boolean;
  order: number;
}

export interface Goal {
  id: string;
  kind: GoalKind;
  tracking: GoalTracking;
  title: string;
  description?: string;
  categoryId?: string;
  target: number;
  unit?: string;
  period: GoalPeriod;
  deadline?: string;
  startDate: string;
  weight: number;
  color?: string;
  autoTrackMode?: GoalAutoTrackMode;
  trackedBlockKeys?: string[];
  createdAt: string;
  blocks: GoalBlock[];
  subTasks: { id: string; title: string; done: boolean }[];
  looseCommitmentIds: string[];
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.floor((db - da) / 86_400_000);
}

export function computeStreak(goal: Goal, today?: string): number {
  const todayIso = today ?? new Date().toISOString().slice(0, 10);
  if (goal.period === "total") return 0;
  if (goal.period === "daily") {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = addDays(todayIso, -i);
      const p = computeGoalProgress(goal, d);
      if (p.denominator > 0 && p.ratio >= 1) {
        streak++;
      } else if (i > 0) {
        break;
      } else {
        return 0;
      }
    }
    return streak;
  }
  if (goal.period === "weekly") {
    let streak = 0;
    for (let i = 0; i < 52; i++) {
      const d = addDays(todayIso, -i * 7);
      const p = computeGoalProgress(goal, d);
      if (p.denominator > 0 && p.ratio >= 1) {
        streak++;
      } else if (i > 0) {
        break;
      } else {
        return 0;
      }
    }
    return streak;
  }
  if (goal.period === "monthly") {
    let streak = 0;
    const d = new Date(todayIso + "T00:00:00");
    for (let i = 0; i < 12; i++) {
      const monthStr = d.toISOString().slice(0, 7);
      const firstOfMonth = monthStr + "-01";
      const p = computeGoalProgress(goal, firstOfMonth);
      if (p.denominator > 0 && p.ratio >= 1) {
        streak++;
      } else if (i > 0) {
        break;
      }
      d.setMonth(d.getMonth() - 1);
    }
    return streak;
  }
  return 0;
}

export function daysUntilDeadline(deadline: string): number {
  const now = new Date();
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(deadline + "T00:00:00");
  return Math.round((d.getTime() - nowMid.getTime()) / 86_400_000);
}

export interface ProgressSnapshot {
  date: string;
  goalId: string;
  numerator: number;
  denominator: number;
}

export interface ScheduleData {
  meta: {
    version: number;
    owner: string;
    cycle: { name: string; number: number; week: number; progress: number };
    workdayStart: string;
    workdayEnd: string;
    enforceSleepBoundary?: boolean;
    focusCategoryIds?: string[];
    sleepWindow?: { start: string; end: string };
    sleepSchedule?: SleepScheduleEntry[];
    sleepCuts?: SleepCut[];
  };
  categories: Category[];
  routine: RoutineBlock[];
  commitments: Commitment[];
  presets: Preset[];
  suggestions: Suggestion[];
  goals: Goal[];
  ledger: {
    compositionScore: number;
    metrics: { label: string; value: number }[];
    scheduledHours: number[];
  };
  progressSnapshots: ProgressSnapshot[];
}

export function getPeriodStartEnd(startDate: string, period: "daily" | "weekly" | "monthly" | "total", today: string): { start: string; end: string } {
  switch (period) {
    case "daily":
      return { start: today, end: today };
    case "weekly": {
      const offset = daysBetween(startDate, today) % 7;
      const weekStart = offset >= 0 ? addDays(today, -offset) : addDays(today, -(7 + offset));
      return { start: weekStart, end: addDays(weekStart, 6) };
    }
    case "monthly": {
      const dayOfMonth = parseInt(startDate.slice(8), 10);
      const todayDate = parseInt(today.slice(8), 10);
      let start: string;
      if (todayDate >= dayOfMonth) {
        start = today.slice(0, 8) + String(dayOfMonth).padStart(2, "0");
      } else {
        const prev = new Date(today + "T00:00:00");
        prev.setMonth(prev.getMonth() - 1);
        start = prev.toISOString().slice(0, 8) + String(dayOfMonth).padStart(2, "0");
      }
      const endDate = new Date(start + "T00:00:00");
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(endDate.getDate() - 1);
      const end = endDate.toISOString().slice(0, 10);
      return { start, end };
    }
    case "total":
      return { start: startDate, end: "9999-12-31" };
  }
}

export interface GoalProgress {
  numerator: number;
  denominator: number;
  ratio: number;
}

function minIsoDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function observedPeriodEnd(goal: Goal, periodEnd: string, todayIso: string): string {
  if (goal.period !== "total") return periodEnd;
  const todayOrDeadline = goal.deadline ? minIsoDate(todayIso, goal.deadline) : todayIso;
  return minIsoDate(periodEnd, todayOrDeadline);
}

function routineStatsInPeriod(r: RoutineBlock, period: { start: string; end: string }) {
  let count = 0;
  let minutes = 0;
  const start = new Date(period.start + "T00:00:00");
  const end = new Date(period.end + "T00:00:00");
  const duration = durationMin(r.start, r.end);

  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === r.day) {
      count += 1;
      minutes += duration;
    }
  }

  return { count, minutes };
}

function commitmentIsInPeriod(c: Commitment, period: { start: string; end: string }) {
  return !!c.date && c.date >= period.start && c.date <= period.end;
}

function commitmentIsDone(c: Commitment, now = new Date()) {
  if (!c.date) return false;
  const endDate = c.endDate ?? (c.endsNextDay || c.end <= c.start ? addDays(c.date, 1) : c.date);
  return new Date(endDate + "T" + (c.end || "23:59")) <= now;
}

export function computeGoalProgress(
  g: Goal,
  today?: string,
  allGoals?: Goal[],
  routine?: RoutineBlock[],
  commitments?: Commitment[]
): GoalProgress {
  const todayIso = today ?? new Date().toISOString().slice(0, 10);
  const period = getPeriodStartEnd(g.startDate, g.period, todayIso);
  const observedPeriod = { ...period, end: observedPeriodEnd(g, period.end, todayIso) };
  const blocksInPeriod = g.blocks.filter((b) => b.date >= period.start && b.date <= observedPeriod.end);
  let numerator = 0;
  let denominator = 0;
  switch (g.tracking) {
    case "none":
      if (g.kind === "deadline" && g.deadline) {
        denominator = 1;
        numerator = todayIso >= g.deadline ? 1 : 0;
      }
      break;
    case "goalBlock":
      denominator = g.target;
      numerator = blocksInPeriod.filter((b) => b.done).length;
      break;
    case "subTask":
      denominator = g.subTasks.length;
      numerator = g.subTasks.filter((st) => st.done).length;
      break;
    case "quota":
      denominator = g.target;
      numerator = blocksInPeriod.filter((b) => b.done).reduce((s, b) => s + b.duration, 0);
      break;
    case "category": {
      denominator = g.target;
      const targetCat = g.categoryId;
      if (!targetCat) break;
      const mode = g.autoTrackMode ?? "always";
      if (mode === "commitments") {
        const linked = (commitments ?? []).filter(
          (c) => g.looseCommitmentIds.includes(c.id) && commitmentIsInPeriod(c, observedPeriod)
        );
        const done = linked.filter((c) => commitmentIsDone(c, new Date(todayIso + "T23:59:59")));
        numerator = g.kind === "duration"
          ? done.reduce((s, c) => s + durationMin(c.start, c.end), 0)
          : Math.min(done.length, denominator);
        break;
      }
      if (mode === "selected") {
        const blockKeys = g.trackedBlockKeys ?? [];
        const selectedRoutine = (routine ?? []).filter(
          (r) => r.kind === targetCat && blockKeys.includes("routine-" + r.id)
        );
        const routineStats = selectedRoutine
          .map((r) => routineStatsInPeriod(r, observedPeriod))
          .reduce((acc, stats) => ({ count: acc.count + stats.count, minutes: acc.minutes + stats.minutes }), { count: 0, minutes: 0 });
        const selectedCommitments = (commitments ?? []).filter(
          (c) => c.kind === targetCat && blockKeys.includes("commitment-" + c.id) && commitmentIsInPeriod(c, observedPeriod)
        );
        const commitmentCount = selectedCommitments.length;
        const commitmentMinutes = selectedCommitments.reduce((s, c) => s + durationMin(c.start, c.end), 0);
        const relevant = allGoals
          ? allGoals.filter((og) => og.categoryId === targetCat).flatMap((og) => og.blocks)
          : g.blocks;
        const selectedGoalBlocks = relevant.filter(
          (b) => b.done && b.date >= period.start && b.date <= observedPeriod.end && blockKeys.includes("goalblock-" + b.id)
        );
        const goalBlockCount = selectedGoalBlocks.length;
        const goalBlockMinutes = selectedGoalBlocks.reduce((s, b) => s + b.duration, 0);
        numerator = g.kind === "duration"
          ? routineStats.minutes + commitmentMinutes + goalBlockMinutes
          : routineStats.count + commitmentCount + goalBlockCount;
        break;
      }
      // mode === "always"
      let count = 0;
      let minutes = 0;
      for (const r of routine ?? []) {
        if (r.kind !== targetCat) continue;
        const stats = routineStatsInPeriod(r, observedPeriod);
        count += stats.count;
        minutes += stats.minutes;
      }
      for (const c of commitments ?? []) {
        if (c.kind !== targetCat) continue;
        if (commitmentIsInPeriod(c, observedPeriod)) {
          count += 1;
          minutes += durationMin(c.start, c.end);
        }
      }
      const relevant = allGoals
        ? allGoals.filter((og) => og.categoryId === targetCat).flatMap((og) => og.blocks)
        : g.blocks;
      const doneGoalBlocks = relevant.filter((b) => b.done && b.date >= period.start && b.date <= observedPeriod.end);
      count += doneGoalBlocks.length;
      minutes += doneGoalBlocks.reduce((s, b) => s + b.duration, 0);
      numerator = g.kind === "duration" ? minutes : count;
      break;
    }
  }
  const ratio = denominator > 0 ? Math.min(1, numerator / denominator) : 0;
  return { numerator, denominator, ratio };
}
