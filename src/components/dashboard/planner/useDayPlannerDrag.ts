import { useCallback, useEffect, useRef, useState } from "react";
import type { ScheduleData } from "@/lib/schedule/types";
import { SNAP, snapTime, clockTimeFromMin, durationMin, timeToMinutes } from "@/lib/schedule/types";
import type { AgendaItem } from "@/lib/schedule/agenda";
import { buildAgendaForDate } from "@/lib/schedule/agenda";
import { getSleepWindowForDay } from "@/lib/schedule/sleep";
import { HOUR_PX, addDays, toIsoDate, topFor } from "@/lib/schedule/planner-format";
import { TEASE_MIN, COMMIT_MIN, MIN_IN_DAY, sleepCutsToRanges, intersectsSleepCut, clampStartAvoidingSleepCuts } from "@/lib/schedule/planner-drag-math";

interface DragState {
  id: string;
  sourceId: string;
  source: "routine" | "commitment";
  originY: number;
  origStartMin: number;
  origDurMin: number;
  sourceSpansNextDay: boolean;
  transitionEdge: "top" | "bottom";
  minStartMin: number;
  maxStartMin: number;
  maxPrevSpillMin: number;
  maxNextSpillMin: number;
  prevLimitKind: "block" | "sleep" | "min-current";
  nextLimitKind: "block" | "sleep" | "min-current";
  crossDayAllowed: boolean;
}

interface UseDayPlannerDragOptions {
  data: ScheduleData;
  selectedDate: Date;
  selectedDateIso: string;
  startMin: number;
  endMin: number;
  projectMinute: (minute: number) => number;
  nonSleepAgenda: AgendaItem[];
  routineById: Map<string, ScheduleData["routine"][number]>;
  commitmentById: Map<string, ScheduleData["commitments"][number]>;
  enforceSleepBoundary: boolean;
  effectiveSleepEntry: { start?: string; end?: string } | null;
  sleepStartMin: number;
  sleepEndMin: number;
  wakeOnlySleep: boolean;
  isToday: boolean;
  nowMin: number;
  bcp47: string;
  pushMoveDayChain: (date: Date, source: "routine" | "commitment", id: string, newStart: string, newEnd: string, dragDeltaMin?: number, dragEdge?: "top" | "bottom") => string | null;
  sleepSplits: Array<{ startMin: number; endMin: number; durMin: number; laneMin: number }>;
}

export function useDayPlannerDrag({
  data,
  selectedDate,
  selectedDateIso,
  startMin,
  endMin,
  projectMinute,
  nonSleepAgenda,
  routineById,
  commitmentById,
  enforceSleepBoundary,
  effectiveSleepEntry,
  sleepStartMin,
  sleepEndMin,
  wakeOnlySleep,
  isToday,
  nowMin,
  bcp47,
  pushMoveDayChain,
  sleepSplits,
}: UseDayPlannerDragOptions) {
  const dragState = useRef<DragState | null>(null);
  const [dragDeltaMin, setDragDeltaMin] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragDeltaRef = useRef(0);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [dragLimitHint, setDragLimitHint] = useState<string | null>(null);
  const [dragTransitionHint, setDragTransitionHint] = useState<{ edge: "top" | "bottom"; direction: "up" | "down"; pending: boolean } | null>(null);
  const hasDraggedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
        dragCleanupRef.current = null;
      }
    };
  }, []);

  function clearDragState() {
    dragState.current = null;
    setDraggingId(null);
    setDragDeltaMin(0);
    dragDeltaRef.current = 0;
    setDragLimitHint(null);
    setDragTransitionHint(null);
  }

  function updateDragPreview(rawDeltaMin: number) {
    if (!dragState.current) return;
    const isPt = bcp47.toLowerCase().startsWith("pt");
    const todaySleepCuts = sleepCutsToRanges(data.meta.sleepCuts ?? [], selectedDateIso);
    const {
      origStartMin,
      origDurMin,
      transitionEdge,
      sourceSpansNextDay,
      crossDayAllowed,
      minStartMin,
      maxStartMin,
      maxPrevSpillMin,
      maxNextSpillMin,
      prevLimitKind,
      nextLimitKind,
    } = dragState.current;
    const dayEndMin = 24 * 60;
    const canReachBottomBoundary = maxStartMin + origDurMin >= dayEndMin;
    const canReachTopBoundary = transitionEdge === "top" || crossDayAllowed || minStartMin <= 0;
    const canSpillCrossDay = sourceSpansNextDay || transitionEdge === "top" || crossDayAllowed;
    const limitTop = isPt ? "Limite superior" : "Upper limit";
    const limitBottom = isPt ? "Limite inferior" : "Lower limit";
    const limitFromKind = (kind: "block" | "sleep" | "min-current", edge: "top" | "bottom") => {
      if (kind === "block") {
        return edge === "bottom"
          ? (isPt ? "Limite: bloco amanhã" : "Limit: next-day block")
          : (isPt ? "Limite: bloco ontem" : "Limit: previous-day block");
      }
      if (kind === "sleep") {
        return isPt ? "Limite: sono noturno" : "Limit: overnight sleep";
      }
      return isPt ? "Mín. 15m hoje" : "Min 15m today";
    };
    const applyPreviewStart = (
      previewStart: number,
      hint: { edge: "top" | "bottom"; direction: "up" | "down"; pending: boolean } | null,
      label: string | null,
    ) => {
      const previewDelta = previewStart - origStartMin;
      setDragDeltaMin(previewDelta);
      dragDeltaRef.current = previewDelta;
      setDragTransitionHint(hint);
      setDragLimitHint(label);
    };

    if (transitionEdge === "bottom") {
      const rawStart = origStartMin + rawDeltaMin;
      const rawEnd = rawStart + origDurMin;
      const spillMin = rawEnd - dayEndMin;

      if (rawStart < 0 && canReachTopBoundary && canSpillCrossDay) {
        const spillIntoPrevDay = -rawStart;
        const clampedSpill = Math.max(0, Math.min(spillIntoPrevDay, maxPrevSpillMin));
        const previewStart = -clampedSpill;
        const hitLimit = spillIntoPrevDay > maxPrevSpillMin;
        const commitThreshold = Math.min(COMMIT_MIN, maxPrevSpillMin);

        if (clampedSpill >= commitThreshold) {
          applyPreviewStart(
            previewStart,
            { edge: "top", direction: "up", pending: false },
            hitLimit ? limitFromKind(prevLimitKind, "top") : (isPt ? `${Math.round(clampedSpill)}m no dia anterior` : `${Math.round(clampedSpill)}m into prev day`),
          );
          return;
        }

        if (spillIntoPrevDay >= TEASE_MIN && maxPrevSpillMin >= TEASE_MIN) {
          applyPreviewStart(0, { edge: "top", direction: "up", pending: true }, hitLimit ? limitFromKind(prevLimitKind, "top") : null);
          return;
        }

        applyPreviewStart(previewStart, null, hitLimit ? limitFromKind(prevLimitKind, "top") : null);
        return;
      }

      if (spillMin > 0 && canReachBottomBoundary && canSpillCrossDay) {
        const clampedSpill = Math.max(0, Math.min(spillMin, maxNextSpillMin));
        const previewStart = Math.min(dayEndMin - SNAP, dayEndMin - origDurMin + clampedSpill);
        const hitLimit = spillMin > maxNextSpillMin;
        const commitThreshold = Math.min(COMMIT_MIN, maxNextSpillMin);

        if (clampedSpill >= commitThreshold) {
          applyPreviewStart(
            previewStart,
            { edge: "bottom", direction: "down", pending: false },
            hitLimit ? limitFromKind(nextLimitKind, "bottom") : (isPt ? `${Math.round(clampedSpill)}m no próximo dia` : `${Math.round(clampedSpill)}m into next day`),
          );
          return;
        }

        if (spillMin >= TEASE_MIN && maxNextSpillMin >= TEASE_MIN) {
          applyPreviewStart(
            dayEndMin - origDurMin,
            { edge: "bottom", direction: "down", pending: true },
            hitLimit ? limitFromKind(nextLimitKind, "bottom") : null,
          );
          return;
        }

        applyPreviewStart(previewStart, null, hitLimit ? limitFromKind(nextLimitKind, "bottom") : null);
        return;
      }

      const clampedStartBase = Math.max(minStartMin, Math.min(rawStart, maxStartMin));
      const clampedStart = clampStartAvoidingSleepCuts(
        clampedStartBase,
        origDurMin,
        minStartMin,
        maxStartMin,
        todaySleepCuts,
        rawStart >= origStartMin,
      );
      if (clampedStart === null) {
        applyPreviewStart(clampedStartBase, null, isPt ? "Limite: pausa de sono" : "Limit: sleep break");
        return;
      }
      if (clampedStart <= minStartMin && rawStart < minStartMin) {
        applyPreviewStart(clampedStart, null, limitTop);
      } else if (clampedStart >= maxStartMin && rawStart > maxStartMin) {
        applyPreviewStart(clampedStart, null, maxStartMin + origDurMin >= dayEndMin ? (isPt ? "Fim do dia" : "End of day") : limitBottom);
      } else {
        applyPreviewStart(clampedStart, null, null);
      }
      return;
    }

    if (transitionEdge === "top") {
      const rawStart = origStartMin + rawDeltaMin;
      const spillIntoPrevDay = -rawStart;

      if (rawStart < 0 && canReachTopBoundary && canSpillCrossDay) {
        const clampedSpill = Math.max(0, Math.min(spillIntoPrevDay, maxPrevSpillMin));
        const previewStart = -clampedSpill;
        const hitLimit = spillIntoPrevDay > maxPrevSpillMin;

        if (clampedSpill >= COMMIT_MIN) {
          applyPreviewStart(
            previewStart,
            { edge: "top", direction: "up", pending: false },
            hitLimit ? limitFromKind(prevLimitKind, "top") : (isPt ? `${Math.round(clampedSpill)}m no dia anterior` : `${Math.round(clampedSpill)}m into prev day`),
          );
          return;
        }

        if (spillIntoPrevDay >= TEASE_MIN && maxPrevSpillMin >= TEASE_MIN) {
          applyPreviewStart(0, { edge: "top", direction: "up", pending: true }, hitLimit ? limitFromKind(prevLimitKind, "top") : null);
          return;
        }

        applyPreviewStart(previewStart, null, hitLimit ? limitFromKind(prevLimitKind, "top") : null);
        return;
      }

      const clampedStartBase = Math.max(0, Math.min(rawStart, maxStartMin));
      const clampedStart = clampStartAvoidingSleepCuts(
        clampedStartBase,
        origDurMin,
        0,
        maxStartMin,
        todaySleepCuts,
        rawStart >= origStartMin,
      );
      if (clampedStart === null) {
        applyPreviewStart(clampedStartBase, null, isPt ? "Limite: pausa de sono" : "Limit: sleep break");
        return;
      }
      applyPreviewStart(clampedStart, null, rawStart > maxStartMin ? (maxStartMin + origDurMin >= dayEndMin ? (isPt ? "Fim do dia" : "End of day") : limitBottom) : null);
    }
  }

  function commitDrag(snappedDelta: number) {
    if (!dragState.current) return;
    const { sourceId, source, origStartMin, origDurMin, transitionEdge } = dragState.current;

    if (transitionEdge === "bottom") {
      const absoluteStart = origStartMin + snappedDelta;
      const newStart = clockTimeFromMin(absoluteStart);
      const newEnd = clockTimeFromMin(absoluteStart + origDurMin);
      pushMoveDayChain(selectedDate, source, sourceId, newStart, newEnd, snappedDelta, "bottom");
      return;
    }

    if (transitionEdge === "top") {
      const absoluteStart = origStartMin + snappedDelta;
      const newStart = clockTimeFromMin(absoluteStart);
      const newEnd = clockTimeFromMin(absoluteStart + origDurMin);
      pushMoveDayChain(selectedDate, source, sourceId, newStart, newEnd, snappedDelta, "top");
    }
  }

  const onGripDown = useCallback(function onGripDown(e: React.PointerEvent, a: AgendaItem) {
    e.preventDefault();
    if (a.kind === "sleep") return;
    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }
    const gripEl = e.currentTarget as HTMLElement;
    gripEl.setPointerCapture(e.pointerId);
    const sourceId = a.sourceId ?? a.id;
    let sourceStart = a.start;
    let sourceEnd = a.end;
    let sourceSpansNextDay = false;
    if (a.source === "routine") {
      const src = routineById.get(sourceId);
      if (src) {
        sourceStart = src.start;
        sourceEnd = src.end;
        sourceSpansNextDay = src.endsNextDay ?? src.end <= src.start;
      }
    } else {
      const src = commitmentById.get(sourceId);
      if (src) {
        sourceStart = src.start;
        sourceEnd = src.end;
        sourceSpansNextDay = src.endsNextDay ?? (Boolean(src.endDate && src.endDate > src.date) || src.end <= src.start);
      }
    }
    const hasDragSleepBoundary = enforceSleepBoundary && effectiveSleepEntry !== null && sleepStartMin > sleepEndMin;
    const wakeBoundMin = enforceSleepBoundary && effectiveSleepEntry !== null && (hasDragSleepBoundary || wakeOnlySleep)
      ? sleepEndMin
      : 0;
    const bedBoundMin = hasDragSleepBoundary ? sleepStartMin : 24 * 60;
    const sourceDurMin = durationMin(sourceStart, sourceEnd);
    const transitionEdge: "top" | "bottom" = a.continuesFromPrevDay ? "top" : "bottom";
    const isSameSource = (item: AgendaItem) => item.source === a.source && (item.sourceId ?? item.id) === sourceId;
    const nextDate = addDays(selectedDate, 1);
    const prevDate = addDays(selectedDate, -1);
    const nextDayIso = toIsoDate(nextDate);
    const prevDayIso = toIsoDate(prevDate);
    const nextDayCapacityBlocks = buildAgendaForDate(data, nextDate)
      .filter((item) => item.kind !== "sleep" && !isSameSource(item as AgendaItem))
      .reduce((min, item) => Math.min(min, timeToMinutes(item.start)), 24 * 60);
    const nextDayCutStart = sleepCutsToRanges(data.meta.sleepCuts ?? [], nextDayIso).reduce((min, c) => Math.min(min, c.start), 24 * 60);
    const nextSleepEntry = getSleepWindowForDay(data.meta.sleepSchedule, nextDate.getDay());
    const hasNextDayOvernightSleep = enforceSleepBoundary && nextSleepEntry !== null
      && timeToMinutes(nextSleepEntry.start) > timeToMinutes(nextSleepEntry.end);
    const nextDayWake = hasNextDayOvernightSleep
      ? timeToMinutes(nextSleepEntry!.end)
      : 24 * 60;
    const nextDayCapacity = Math.min(nextDayCapacityBlocks, nextDayCutStart, nextDayWake);

    const prevDayCapacityBlocks = 24 * 60 - buildAgendaForDate(data, prevDate)
      .filter((item) => item.kind !== "sleep" && !isSameSource(item as AgendaItem))
      .reduce((max, item) => Math.max(max, timeToMinutes(item.end)), 0);
    const prevDayCutEnd = sleepCutsToRanges(data.meta.sleepCuts ?? [], prevDayIso).reduce((max, c) => Math.max(max, c.end), 0);
    const prevDayCapacityCuts = 24 * 60 - prevDayCutEnd;
    const prevDayCapacity = Math.min(prevDayCapacityBlocks, prevDayCapacityCuts);

    const origStartMin = transitionEdge === "top" ? timeToMinutes(sourceStart) - 24 * 60 : timeToMinutes(sourceStart);
    const origDurMin = sourceDurMin;

    const maxCurrentDaySpill = Math.max(0, origDurMin - MIN_IN_DAY);
    const maxPrevSpillMin = transitionEdge === "top"
      ? Math.max(0, Math.min(Math.abs(origStartMin) + origDurMin, maxCurrentDaySpill))
      : Math.max(0, Math.min(maxCurrentDaySpill, prevDayCapacity));
    const maxNextSpillMin = sourceSpansNextDay
      ? origDurMin
      : Math.min(maxCurrentDaySpill, nextDayCapacity);
    const prevLimitKind: "block" | "sleep" | "min-current" = prevDayCapacity < maxCurrentDaySpill
      ? (prevDayCapacityCuts <= prevDayCapacityBlocks ? "sleep" : "block")
      : "min-current";
    const nextLimitKind: "block" | "sleep" | "min-current" = nextDayCapacity < maxCurrentDaySpill
      ? (hasNextDayOvernightSleep && nextDayWake === nextDayCapacity ? "sleep" : "block")
      : "min-current";
    const minStartMin = transitionEdge === "top" || sourceSpansNextDay ? 0 : wakeBoundMin;
    const maxStartMin = sourceSpansNextDay ? 24 * 60 - SNAP : bedBoundMin - origDurMin;
    const crossDayAllowed = !effectiveSleepEntry || hasDragSleepBoundary || hasNextDayOvernightSleep || wakeOnlySleep;
    dragState.current = {
      id: a.id,
      sourceId,
      source: a.source,
      originY: e.clientY,
      origStartMin,
      origDurMin,
      sourceSpansNextDay: transitionEdge === "top" || sourceSpansNextDay,
      transitionEdge,
      minStartMin,
      maxStartMin,
      maxPrevSpillMin,
      maxNextSpillMin,
      prevLimitKind,
      nextLimitKind,
      crossDayAllowed,
    };
    setDraggingId(a.id);
    setDragDeltaMin(0);
    dragDeltaRef.current = 0;
    hasDraggedRef.current = false;
    setDragLimitHint(null);

    const handlePointerMove = (ev: PointerEvent) => {
      if (!dragState.current) return;
      hasDraggedRef.current = true;
      const rawDeltaPx = ev.clientY - dragState.current.originY;
      const rawDeltaMin = (rawDeltaPx / HOUR_PX) * 60;
      const snapped = Math.round(rawDeltaMin / SNAP) * SNAP;
      updateDragPreview(snapped);
    };
    const handlePointerDone = (_ev: PointerEvent) => {
      if (!dragState.current) return;
      const snapped = dragDeltaRef.current;
      commitDrag(snapped);
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
        dragCleanupRef.current = null;
      }
      clearDragState();
      setTimeout(() => { hasDraggedRef.current = false; }, 0);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerDone, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerDone);
    };
  }, [data, selectedDate, routineById, commitmentById, enforceSleepBoundary, effectiveSleepEntry, sleepStartMin, sleepEndMin, bcp47, selectedDateIso, pushMoveDayChain]);

  return {
    dragState,
    draggingId,
    dragDeltaMin,
    dragLimitHint,
    dragTransitionHint,
    hasDraggedRef,
    onGripDown,
    clearDragState,
  };
}
