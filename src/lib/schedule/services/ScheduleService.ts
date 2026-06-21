import type { Category, CategoryRole, Commitment, Goal, GoalBlock, Preset, RoutineBlock, ScheduleData, SleepCut, SleepScheduleEntry } from "../types";
import { timeToMinutes, durationMin, getPeriodStartEnd, computeGoalProgress, isGoalTrackingValid, isGoalPeriodValid, getDefaultGoalTracking, getDefaultGoalPeriod } from "../types";
import { uid, addDaysToIso, dateToIso, minutesToTime, buildRoutineWeeklySegments, commitmentInterval, intervalsOverlap, resolveCommitmentEndDate, sortedDayBlocks } from "../helpers";
import { validateRoutineSleepOverlap, validateCommitmentSleepOverlap, migrateSleepSchedule, normalizeSleepWindow, sanitizeSleepWindow, getSleepWindowForDay } from "../sleep";
import { buildAgendaForDate } from "../agenda";
import { buildLedger, recomputeOverallGoalProgress } from "../ledger";
import { generateLocalSuggestions } from "../suggestions";
import { checkRoutineConflict, checkCommitmentConflict, buildCandidateRoutine, buildCandidateCommitment } from "./ScheduleValidator";
import { normalizeNamingModel } from "./ScheduleMigrator";
import type { Locale } from "@/lib/i18n/dictionaries";
import { SCHEMA_VERSION } from "../ports/ScheduleRepository";

/* ─── Derivation ─── */

export function withDerived(data: ScheduleData, regenerateSuggestions = false, locale: string = "en"): ScheduleData {
  return {
    ...data,
    meta: {
      ...data.meta,
      version: SCHEMA_VERSION,
    },
    ledger: buildLedger(data),
    suggestions: regenerateSuggestions ? generateLocalSuggestions(data, locale as "en" | "pt") : data.suggestions,
  };
}

/* ─── Routine CRUD ─── */

export function addRoutine(data: ScheduleData, b: Omit<RoutineBlock, "id">): ScheduleData | string {
  const candidate = buildCandidateRoutine(b);
  const err = checkRoutineConflict(data, candidate);
  if (err) return err;
  return { ...data, routine: [...data.routine, { ...candidate, id: uid("r") }] };
}

export function updateRoutine(data: ScheduleData, id: string, patch: Partial<RoutineBlock>): ScheduleData | string {
  const current = data.routine.find((r) => r.id === id);
  if (!current) return "Block not found.";
  const next: RoutineBlock = {
    ...current,
    ...patch,
    endsNextDay: patch.endsNextDay ?? current.endsNextDay ?? ((patch.end ?? current.end) <= (patch.start ?? current.start)),
  };
  const sleepErr = validateRoutineSleepOverlap(data, next);
  if (sleepErr) return sleepErr;
  const err = checkRoutineConflict(data, next, id);
  if (err) return err;
  return { ...data, routine: data.routine.map((r) => (r.id === id ? next : r)) };
}

export function removeRoutine(data: ScheduleData, id: string): ScheduleData {
  return { ...data, routine: data.routine.filter((r) => r.id !== id) };
}

/* ─── Commitment CRUD ─── */

export function addCommitment(data: ScheduleData, c: Omit<Commitment, "id">): ScheduleData | string {
  const candidate = buildCandidateCommitment(c);
  if (c.date) {
    const err = checkCommitmentConflict(data, candidate);
    if (err) return err;
  }
  return { ...data, commitments: [...data.commitments, { ...candidate, id: uid("c") }] };
}

export function updateCommitment(data: ScheduleData, id: string, patch: Partial<Commitment>): ScheduleData | string {
  const current = data.commitments.find((c) => c.id === id);
  if (!current) return "Commitment not found.";
  const next: Commitment = {
    ...current,
    ...patch,
    endsNextDay: patch.endsNextDay ?? current.endsNextDay ?? ((patch.end ?? current.end) <= (patch.start ?? current.start)),
  };
  if (next.date) {
    const err = checkCommitmentConflict(data, next, id);
    if (err) return err;
  }
  return { ...data, commitments: data.commitments.map((c) => (c.id === id ? next : c)) };
}

export function removeCommitment(data: ScheduleData, id: string): ScheduleData {
  return { ...data, commitments: data.commitments.filter((c) => c.id !== id) };
}

/* ─── Preset CRUD ─── */

export function addPreset(data: ScheduleData, p: Omit<Preset, "id">): { data: ScheduleData; id: string } {
  const id = uid("p");
  return { data: { ...data, presets: [...data.presets, { ...p, id }] }, id };
}

export function removePreset(data: ScheduleData, id: string): ScheduleData {
  return { ...data, presets: data.presets.filter((p) => p.id !== id) };
}

export function updatePreset(data: ScheduleData, id: string, patch: Partial<Preset>): ScheduleData {
  return { ...data, presets: data.presets.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
}

/* ─── Goal CRUD ─── */

export function addGoal(data: ScheduleData, g: Omit<Goal, "id" | "blocks" | "subTasks" | "looseCommitmentIds" | "createdAt">): { data: ScheduleData; id: string } {
  const id = uid("goal");
  const tracking = isGoalTrackingValid(g.kind, g.tracking) ? g.tracking : getDefaultGoalTracking(g.kind);
  const period = isGoalPeriodValid(g.kind, tracking, g.period) ? g.period : getDefaultGoalPeriod(g.kind, tracking);
  return {
    data: {
      ...data,
      goals: [...data.goals, { ...g, tracking, period, id, blocks: [], subTasks: [], looseCommitmentIds: [], createdAt: new Date().toISOString() }],
    },
    id,
  };
}

export function updateGoal(data: ScheduleData, id: string, patch: Partial<Goal>): ScheduleData {
  return {
    ...data,
    goals: data.goals.map((g) => {
      if (g.id !== id) return g;
      const merged = { ...g, ...patch };
      const kind = merged.kind;
      const tracking = isGoalTrackingValid(kind, merged.tracking) ? merged.tracking : getDefaultGoalTracking(kind);
      const period = isGoalPeriodValid(kind, tracking, merged.period) ? merged.period : getDefaultGoalPeriod(kind, tracking);
      return { ...merged, tracking, period };
    }),
  };
}

export function removeGoal(data: ScheduleData, id: string): ScheduleData {
  return { ...data, goals: data.goals.filter((g) => g.id !== id) };
}

export function addGoalBlock(data: ScheduleData, goalId: string, b: Omit<GoalBlock, "id">): { data: ScheduleData; id: string } {
  const id = uid("gb");
  return { data: { ...data, goals: data.goals.map((g) => (g.id === goalId ? { ...g, blocks: [...g.blocks, { ...b, id }] } : g)) }, id };
}

export function updateGoalBlock(data: ScheduleData, goalId: string, blockId: string, patch: Partial<GoalBlock>): ScheduleData {
  return { ...data, goals: data.goals.map((g) => (g.id === goalId ? { ...g, blocks: g.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) } : g)) };
}

export function removeGoalBlock(data: ScheduleData, goalId: string, blockId: string): ScheduleData {
  return { ...data, goals: data.goals.map((g) => (g.id === goalId ? { ...g, blocks: g.blocks.filter((b) => b.id !== blockId) } : g)) };
}

export function toggleGoalBlock(data: ScheduleData, goalId: string, blockId: string): ScheduleData {
  return { ...data, goals: data.goals.map((g) => (g.id === goalId ? { ...g, blocks: g.blocks.map((b) => (b.id === blockId ? { ...b, done: !b.done } : b)) } : g)) };
}

export function addGoalSubTask(data: ScheduleData, goalId: string, title: string): ScheduleData {
  const id = uid("gst");
  return { ...data, goals: data.goals.map((g) => (g.id === goalId ? { ...g, subTasks: [...g.subTasks, { id, title, done: false }] } : g)) };
}

export function toggleGoalSubTask(data: ScheduleData, goalId: string, subTaskId: string): ScheduleData {
  return { ...data, goals: data.goals.map((g) => (g.id === goalId ? { ...g, subTasks: g.subTasks.map((st) => (st.id === subTaskId ? { ...st, done: !st.done } : st)) } : g)) };
}

export function linkLooseCommitment(data: ScheduleData, goalId: string, commitmentId: string): ScheduleData {
  return { ...data, goals: data.goals.map((g) => (g.id === goalId ? { ...g, looseCommitmentIds: [...new Set([...g.looseCommitmentIds, commitmentId])] } : g)) };
}

export function generateGoalCommitments(data: ScheduleData, goalId: string): ScheduleData {
  const goal = data.goals.find((g) => g.id === goalId);
  if (!goal || goal.autoTrackMode !== "commitments") return data;
  const N = goal.target;
  const newIds: string[] = [];
  for (let i = 0; i < N; i++) {
    newIds.push(uid("cmt"));
  }
  return {
    ...data,
    commitments: [
      ...data.commitments,
      ...newIds.map((id, i) => ({
        id,
        date: undefined as string | undefined,
        start: "00:00",
        end: "01:00",
        kind: goal.categoryId ?? "custom",
        title: `${goal.title} ${i + 1}/${N}`,
      })),
    ],
    goals: data.goals.map((g) =>
      g.id === goalId ? { ...g, looseCommitmentIds: [...g.looseCommitmentIds, ...newIds] } : g
    ),
  };
}

export function trackBlockForGoal(data: ScheduleData, goalId: string, blockKey: string): ScheduleData {
  return {
    ...data,
    goals: data.goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            trackedBlockKeys: g.trackedBlockKeys?.includes(blockKey)
              ? g.trackedBlockKeys.filter((k) => k !== blockKey)
              : [...(g.trackedBlockKeys ?? []), blockKey],
          }
        : g
    ),
  };
}

export function isBlockTrackedForAnyGoal(data: ScheduleData, blockKey: string): boolean {
  return data.goals.some((g) => g.trackedBlockKeys?.includes(blockKey));
}

export function overallGoalProgress(data: ScheduleData): number {
  return recomputeOverallGoalProgress(data);
}

export function getGoalsForDate(data: ScheduleData, date: string): Goal[] {
  return data.goals.filter((g) => {
    if (g.startDate > date) return false;
    if (g.deadline && g.deadline < date) return false;
    const period = getPeriodStartEnd(g.startDate, g.period, date);
    if (!(date >= period.start && date <= period.end)) return false;
    if (g.tracking !== "category") return true;
    const mode = g.autoTrackMode ?? "always";
    if (mode === "always") return true;
    if (mode === "selected" && g.trackedBlockKeys?.length) return true;
    if (mode === "commitments" && g.looseCommitmentIds.length) {
      if (data.commitments.some((c) => g.looseCommitmentIds.includes(c.id) && c.date === date)) return true;
    }
    return false;
  });
}

export function recordProgressSnapshots(data: ScheduleData): ScheduleData {
  const todayIso = new Date().toISOString().slice(0, 10);
  const snapshots = data.goals.map((g) => {
    const p = computeGoalProgress(g, todayIso, data.goals, data.routine, data.commitments);
    return { date: todayIso, goalId: g.id, numerator: p.numerator, denominator: p.denominator };
  });
  const existing = data.progressSnapshots.filter((s) => s.date !== todayIso);
  return { ...data, progressSnapshots: [...existing, ...snapshots] };
}

/* ─── Sleep management ─── */

export function updateSleepWindow(data: ScheduleData, patch: Partial<{ start: string; end: string }>): ScheduleData {
  const current = data.meta.sleepWindow ?? normalizeSleepWindow(data);
  const next = sanitizeSleepWindow({ ...current, ...patch }, data.meta.workdayStart);
  const prevSchedule = data.meta.sleepSchedule ?? migrateSleepSchedule(data);
  const nextSchedule = prevSchedule.some((e) => !e.days)
    ? prevSchedule.map((e) => !e.days ? { ...e, start: next.start, end: next.end } : e)
    : [{ start: next.start, end: next.end }, ...prevSchedule];
  return { ...data, meta: { ...data.meta, sleepWindow: next, sleepSchedule: nextSchedule } };
}

export function setSleepBoundaryEnforced(data: ScheduleData, enforced: boolean, locale: Locale): ScheduleData {
  return normalizeNamingModel(
    { ...data, meta: { ...data.meta, enforceSleepBoundary: enforced } },
    locale,
  );
}

export function setFocusCategories(data: ScheduleData, ids: string[]): ScheduleData {
  return { ...data, meta: { ...data.meta, focusCategoryIds: ids.length > 0 ? ids : undefined } };
}

export function updateSleepSchedule(data: ScheduleData, schedule: SleepScheduleEntry[]): ScheduleData {
  const allDay = schedule.find((e) => !e.days);
  const sleepWindow = allDay
    ? sanitizeSleepWindow({ start: allDay.start, end: allDay.end }, data.meta.workdayStart)
    : data.meta.sleepWindow;
  return { ...data, meta: { ...data.meta, sleepSchedule: schedule, sleepWindow } };
}

export function addSleepCut(data: ScheduleData, cut: SleepCut): ScheduleData {
  const incomingStart = timeToMinutes(cut.start);
  const incomingEnd = timeToMinutes(cut.end);
  const sameDate = (data.meta.sleepCuts ?? []).filter((c) => c.date === cut.date);
  const otherDates = (data.meta.sleepCuts ?? []).filter((c) => c.date !== cut.date);

  const sameDateWithoutOverlap = sameDate.filter((c) => {
    const start = timeToMinutes(c.start);
    const end = timeToMinutes(c.end);
    return end <= incomingStart || start >= incomingEnd;
  });

  const next = [...sameDateWithoutOverlap, cut].sort((a, b) => a.start.localeCompare(b.start));
  return { ...data, meta: { ...data.meta, sleepCuts: [...otherDates, ...next] } };
}

export function removeSleepCut(data: ScheduleData, target: { date: string; start?: string; end?: string }): ScheduleData {
  const cuts = (data.meta.sleepCuts ?? []).filter((c) => {
    if (c.date !== target.date) return true;
    if (target.start && target.end) {
      return !(c.start === target.start && c.end === target.end);
    }
    return false;
  });
  return { ...data, meta: { ...data.meta, sleepCuts: cuts } };
}

/* ─── Category operations ─── */

export function updateCategory(data: ScheduleData, id: Category["id"], patch: Partial<Pick<Category, "label" | "labelCustom" | "description" | "descriptionCustom" | "tone" | "color" | "role" | "workspace">>): ScheduleData {
  return { ...data, categories: data.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

export function setCategoryRole(data: ScheduleData, id: Category["id"], role: CategoryRole): ScheduleData {
  const focusIds = new Set(data.meta.focusCategoryIds ?? []);
  if (role === "focus") focusIds.add(id);
  else focusIds.delete(id);
  return {
    ...data,
    categories: data.categories.map((c) => (c.id === id ? { ...c, role } : c)),
    meta: { ...data.meta, focusCategoryIds: [...focusIds] },
  };
}

export function addCategory(data: ScheduleData, cat: Category): ScheduleData {
  return { ...data, categories: [...data.categories, cat] };
}

export function removeCategory(data: ScheduleData, id: Category["id"]): ScheduleData {
  return {
    ...data,
    categories: data.categories.filter((c) => c.id !== id),
    routine: data.routine.filter((r) => r.kind !== id),
    commitments: data.commitments.filter((c) => c.kind !== id),
    presets: data.presets.filter((p) => p.kind !== id),
  };
}

export function resetCategoryNaming(data: ScheduleData, id: Category["id"]): ScheduleData {
  return {
    ...data,
    categories: data.categories.map((c) =>
      c.id === id ? { ...c, labelCustom: undefined, descriptionCustom: undefined } : c,
    ),
  };
}

export function reorderCategory(data: ScheduleData, id: Category["id"], newIndex: number): ScheduleData {
  const cats = [...data.categories];
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return data;
  const [cat] = cats.splice(idx, 1);
  cats.splice(newIndex, 0, cat);
  return { ...data, categories: cats };
}

/* ─── Suggestion operations ─── */

export function applySuggestion(data: ScheduleData, id: string): ScheduleData {
  const s = data.suggestions.find((x) => x.id === id);
  if (!s) return data;
  let routine = data.routine;
  if (s.patch?.type === "add-routine") {
    routine = [...routine, { ...s.patch.block, id: uid("r") }];
  } else if (s.patch?.type === "add-routines") {
    routine = [...routine, ...s.patch.blocks.map((b) => ({ ...b, id: uid("r") }))];
  } else if (s.patch?.type === "remove-routine") {
    const m = s.patch.match;
    routine = routine.filter(
      (r) => !(Object.keys(m) as (keyof RoutineBlock)[]).every((k) => r[k] === m[k]),
    );
  }
  return { ...data, routine, suggestions: data.suggestions.filter((x) => x.id !== id) };
}

export function deferSuggestion(data: ScheduleData, id: string): ScheduleData {
  return { ...data, suggestions: data.suggestions.filter((x) => x.id !== id) };
}

/* ─── Drag / push-move-day-chain ─── */

export function pushMoveDayChain(
  data: ScheduleData,
  date: Date,
  source: "routine" | "commitment",
  id: string,
  newStart: string,
  newEnd: string,
  dragDeltaMin?: number,
  dragEdge?: "top" | "bottom",
): ScheduleData | string {
  const day = date.getDay();
  const dayIso = dateToIso(date);
  const dayAgenda = buildAgendaForDate(data, date).filter((a) => !(a.kind === "sleep" && (a as { sleepBoundary?: boolean }).sleepBoundary));
  const moved = dayAgenda.find((a) => a.id === id && a.source === source);
  if (!moved) return "Block not found.";

  const sourceRoutine = source === "routine" ? data.routine.find((r) => r.id === id) : null;
  const sourceCommitment = source === "commitment" ? data.commitments.find((c) => c.id === id) : null;
  const sourceDuration = sourceRoutine
    ? durationMin(sourceRoutine.start, sourceRoutine.end)
    : sourceCommitment
      ? Math.max(15, Math.round((commitmentInterval(sourceCommitment).end.getTime() - commitmentInterval(sourceCommitment).start.getTime()) / 60_000) || durationMin(sourceCommitment.start, sourceCommitment.end))
      : durationMin(newStart, newEnd);
  const sourceStartMin = sourceRoutine
    ? timeToMinutes(sourceRoutine.start)
    : sourceCommitment
      ? timeToMinutes(sourceCommitment.start)
      : timeToMinutes(moved.start);

  const movedStart = timeToMinutes(newStart);
  const movedEnd = timeToMinutes(newEnd);
  const movedDur = Math.max(15, sourceDuration);

  const enforceSleepBoundary = data.meta.enforceSleepBoundary !== false;
  const sleepForDay = enforceSleepBoundary
    ? buildAgendaForDate(data, date).filter((a) => a.kind === "sleep" && (a as { sleepBoundary?: boolean }).sleepBoundary)
    : [];
  const wakeMin = sleepForDay
    .filter((a) => timeToMinutes(a.end) <= 12 * 60)
    .reduce((m, a) => Math.max(m, timeToMinutes(a.end)), 0);
  const bedMin = sleepForDay
    .filter((a) => timeToMinutes(a.start) >= 18 * 60)
    .reduce((m, a) => Math.min(m, timeToMinutes(a.start)), 24 * 60);
  const boundarySnapTol = 15;
  const sleepCuts = (data.meta.sleepCuts ?? [])
    .filter((c) => c.date === dayIso)
    .map((c) => ({ start: timeToMinutes(c.start), end: timeToMinutes(c.end) }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start);

  const findOverlappingSleepCut = (start: number, end: number) =>
    sleepCuts.find((c) => start < c.end && end > c.start) ?? null;

  const avoidSleepCut = (candidate: number, dur: number, preferForward: boolean) => {
    let nextStart = candidate;
    let guard = 0;
    while (guard < sleepCuts.length + 2) {
      guard += 1;
      const nextEnd = nextStart + dur;
      const overlap = findOverlappingSleepCut(nextStart, nextEnd);
      if (!overlap) return nextStart;

      const beforeStart = Math.max(wakeMin, Math.min(nextStart, overlap.start - dur));
      const beforeEnd = beforeStart + dur;
      const beforeValid = beforeStart >= wakeMin && beforeEnd <= overlap.start && !findOverlappingSleepCut(beforeStart, beforeEnd);

      const afterStart = Math.min(bedMin - dur, Math.max(nextStart, overlap.end));
      const afterEnd = afterStart + dur;
      const afterValid = afterStart >= overlap.end && afterEnd <= bedMin && !findOverlappingSleepCut(afterStart, afterEnd);

      if (beforeValid && afterValid) {
        nextStart = preferForward ? afterStart : beforeStart;
        continue;
      }
      if (afterValid) {
        nextStart = afterStart;
        continue;
      }
      if (beforeValid) {
        nextStart = beforeStart;
        continue;
      }
      return null;
    }
    return null;
  };

  const sourceSpansNextDay = sourceRoutine
    ? (sourceRoutine.endsNextDay ?? sourceRoutine.end <= sourceRoutine.start)
    : sourceCommitment
      ? (sourceCommitment.endsNextDay || resolveCommitmentEndDate(sourceCommitment) > sourceCommitment.date || sourceCommitment.end <= sourceCommitment.start)
      : false;

  const commitCrossdayMove = (absoluteStartMin: number): ScheduleData | string => {
    const dayOffset = Math.floor(absoluteStartMin / (24 * 60));
    const startInDay = ((absoluteStartMin % (24 * 60)) + 24 * 60) % (24 * 60);
    const endAbs = startInDay + movedDur;
    const start = minutesToTime(startInDay);
    const end = minutesToTime(endAbs % (24 * 60));
    const endsNextDay = endAbs > 24 * 60;
    const targetDay = (day + dayOffset + 7) % 7;
    const targetDate = addDaysToIso(dayIso, dayOffset);
    const targetEndDate = endsNextDay ? addDaysToIso(targetDate, 1) : targetDate;

    if (sourceRoutine) {
      const candidate: RoutineBlock = {
        ...sourceRoutine,
        day: targetDay,
        start,
        end,
        endsNextDay,
      };
      const sleepErr = validateRoutineSleepOverlap(data, candidate);
      if (sleepErr) return sleepErr;
      const candidateSegments = buildRoutineWeeklySegments(candidate);
      const conflict = data.routine.find((r) => {
        if (r.id === sourceRoutine.id) return false;
        const existingSegments = buildRoutineWeeklySegments(r);
        return candidateSegments.some((candidateSegment) =>
          existingSegments.some((existingSegment) =>
            candidateSegment.day === existingSegment.day
            && candidateSegment.startMin < existingSegment.endMin
            && existingSegment.startMin < candidateSegment.endMin,
          ),
        );
      });
      if (conflict) {
        return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
      }
      return {
        ...data,
        routine: data.routine.map((r) =>
          r.id === sourceRoutine.id
            ? { ...r, day: targetDay, start, end, endsNextDay }
            : r,
        ),
      };
    }

    if (sourceCommitment) {
      const candidate: Commitment = {
        ...sourceCommitment,
        date: targetDate,
        start,
        end,
        endsNextDay,
        endDate: targetEndDate,
      };
      const sleepErr = validateCommitmentSleepOverlap(data, candidate);
      if (sleepErr) return sleepErr;
      const conflict = data.commitments.find((c) => c.id !== sourceCommitment.id && intervalsOverlap(commitmentInterval(c), commitmentInterval(candidate)));
      if (conflict) {
        return `Conflicts with "${conflict.title}" (${conflict.start}-${conflict.end}).`;
      }
      return {
        ...data,
        commitments: data.commitments.map((c) =>
          c.id === sourceCommitment.id
            ? { ...c, date: targetDate, start, end, endsNextDay, endDate: targetEndDate }
            : c,
        ),
      };
    }

    return "Block not found.";
  };

  if (sourceSpansNextDay) {
    const sourceReferenceStartMin = dragEdge === "top" ? sourceStartMin - 24 * 60 : sourceStartMin;
    const crossStart = typeof dragDeltaMin === "number" ? sourceReferenceStartMin + dragDeltaMin : movedStart;
    const minCrossStart = -(movedDur - 15);
    const clampedCrossStart = Math.max(crossStart, minCrossStart);
    return commitCrossdayMove(clampedCrossStart);
  }

  const rawCandidateStart = typeof dragDeltaMin === "number" ? sourceStartMin + dragDeltaMin : movedStart;
  const rawCandidateEnd = rawCandidateStart + movedDur;
  let candidateStart = rawCandidateStart;

  if (sleepForDay.length > 0 && wakeMin > 0 && rawCandidateStart < wakeMin && wakeMin - rawCandidateStart <= boundarySnapTol) {
    candidateStart = wakeMin;
  }
  if (sleepForDay.length > 0 && bedMin < 24 * 60 && rawCandidateEnd > bedMin && rawCandidateEnd - bedMin <= boundarySnapTol) {
    candidateStart = bedMin - movedDur;
  }

  const sleepEntry = data.meta.sleepSchedule?.length
    ? getSleepWindowForDay(data.meta.sleepSchedule, day)
    : null;
  const nextDaySleepEntry = data.meta.sleepSchedule?.length
    ? getSleepWindowForDay(data.meta.sleepSchedule, (day + 1) % 7)
    : null;
  const hasOvernightSleep = (entry: SleepScheduleEntry | null) =>
    entry !== null && entry.start !== entry.end && timeToMinutes(entry.start) > timeToMinutes(entry.end);
  const isWakeOnlySleep = (entry: SleepScheduleEntry | null) =>
    entry !== null && entry.start === "00:00" && entry.end !== "00:00";
  const hasCrossDaySleep = enforceSleepBoundary
    ? (sleepEntry === null || sleepEntry.start === sleepEntry.end)
      || hasOvernightSleep(sleepEntry)
      || hasOvernightSleep(nextDaySleepEntry)
      || isWakeOnlySleep(sleepEntry)
    : true;

  if (hasCrossDaySleep && (candidateStart < 0 || candidateStart + movedDur > 24 * 60)) {
    const minCrossStart = -(movedDur - 15);
    const maxCrossStart = 24 * 60 - 15;
    const clampedCandidate = Math.max(minCrossStart, Math.min(candidateStart, maxCrossStart));
    return commitCrossdayMove(clampedCandidate);
  }

  const boundedStart = Math.max(wakeMin, Math.min(candidateStart, bedMin - movedDur));
  const preferredForward = movedStart >= sourceStartMin;
  const safeStart = avoidSleepCut(boundedStart, movedDur, preferredForward);
  if (safeStart === null) return "Cannot place block: overlaps a sleep break.";
  const clampedStart = safeStart;
  const clampedEnd = clampedStart + movedDur;

  const reordered = dayAgenda
    .map((a) => {
      if (a.id === id && a.source === source) {
        return { ...a, start: minutesToTime(clampedStart), end: minutesToTime(clampedEnd) };
      }
      return a;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  const idx = reordered.findIndex((a) => a.id === id && a.source === source);
  if (idx < 0) return "Block not found.";

  const adjusted = reordered.map((a) => ({
    ...a,
    s: timeToMinutes(a.start),
    e: timeToMinutes(a.end),
    dur: Math.max(15, timeToMinutes(a.end) - timeToMinutes(a.start)),
  }));
  adjusted[idx].s = clampedStart;
  adjusted[idx].e = clampedStart + movedDur;
  adjusted[idx].dur = movedDur;

  if (idx > 0) {
    const minStart = adjusted[idx - 1].e;
    if (adjusted[idx].s < minStart) {
      adjusted[idx].s = minStart;
      adjusted[idx].e = adjusted[idx].s + adjusted[idx].dur;
    }
  }

  for (let i = idx + 1; i < adjusted.length; i += 1) {
    if (adjusted[i].s < adjusted[i - 1].e) {
      adjusted[i].s = adjusted[i - 1].e;
      adjusted[i].e = adjusted[i].s + adjusted[i].dur;
    } else {
      break;
    }
  }

  const MAX_END = bedMin;
  const overflow = adjusted.length > 0 ? adjusted[adjusted.length - 1].e - MAX_END : 0;
  if (overflow > 0) {
    for (let i = idx; i < adjusted.length; i += 1) {
      adjusted[i].s -= overflow;
      adjusted[i].e -= overflow;
    }
    if (adjusted[idx].s < 0) return "Cannot push more: reached day boundary.";
    for (let i = idx + 1; i < adjusted.length; i += 1) {
      adjusted[i].s = adjusted[i - 1].e;
      adjusted[i].e = adjusted[i].s + adjusted[i].dur;
    }
    if (adjusted[adjusted.length - 1].e > MAX_END) return "Cannot push more: reached sleep boundary.";
  }

  if (sleepCuts.length > 0) {
    for (let i = 0; i < adjusted.length; i += 1) {
      const prevEnd = i > 0 ? adjusted[i - 1].e : wakeMin;
      let nextStart = Math.max(adjusted[i].s, prevEnd);
      let nextEnd = nextStart + adjusted[i].dur;

      const overlap = findOverlappingSleepCut(nextStart, nextEnd);
      if (overlap) {
        nextStart = overlap.end;
        nextEnd = nextStart + adjusted[i].dur;
        if (findOverlappingSleepCut(nextStart, nextEnd)) return "Cannot place block: overlaps a sleep break.";
      }

      if (nextEnd > MAX_END) return "Cannot place block: exceeds sleep boundary.";

      adjusted[i].s = nextStart;
      adjusted[i].e = nextEnd;
    }
  }

  const agendaMap = new Map(adjusted.map((a) => [
    `${a.source}:${a.id}`,
    { start: minutesToTime(Math.max(0, a.s)), end: minutesToTime(Math.min(MAX_END, a.e)) },
  ]));

  const routine = data.routine.map((r) => {
    if (r.day !== day) return r;
    const adj = agendaMap.get(`routine:${r.id}`);
    if (!adj) return r;
    return { ...r, start: adj.start, end: adj.end, endsNextDay: adj.end <= adj.start };
  });
  const commitments = data.commitments.map((c) => {
    const adj = agendaMap.get(`commitment:${c.id}`);
    return adj ? { ...c, start: adj.start, end: adj.end, endsNextDay: adj.end <= adj.start, endDate: (adj.end <= adj.start) ? addDaysToIso(c.date, 1) : c.date } : c;
  });
  return { ...data, routine, commitments };
}

/* ─── Metadata ─── */

export function replaceSchedule(data: ScheduleData, next: ScheduleData, locale: Locale): ScheduleData {
  for (const b of next.routine) {
    if (b.kind !== "sleep" && !next.categories.some((c) => c.id === b.kind)) {
      const label = b.kind.charAt(0).toUpperCase() + b.kind.slice(1);
      next.categories.push({ id: b.kind, label, tone: "neutral", description: `${label} activities.` });
    }
  }
  return normalizeNamingModel(next, locale);
}
