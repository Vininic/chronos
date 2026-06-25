import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef } from "react";
import { useSchedule } from "@/lib/schedule/store";
import { buildAgendaForDate } from "@/lib/schedule/agenda";
import type { AgendaItem } from "@/lib/schedule/agenda";
import { getSleepWindowForDay } from "@/lib/schedule/sleep";
import { BlockKind, SNAP, snapTime, clockTimeFromMin, durationMin, timeToMinutes, fmtDur, daysUntilDeadline } from "@/lib/schedule/types";
import type { SleepCut, SleepScheduleEntry, WorkspaceRuntime } from "@/lib/schedule/types";
import { safeKindStyle, toCssColor, alpha } from "./widgets";
import { useFmtDur, useI18n, useT } from "@/lib/i18n/I18nProvider";
import { isKnownDefaultBlockTitle, useScheduleText } from "@/lib/i18n/scheduleText";
import { ArrowDownToLine, ArrowRightToLine, ArrowUpToLine, ChevronLeft, ChevronRight, Clock, GripVertical, Pencil, Plus, StickyNote, Table2, Trash2, Circle, CheckCircle2, CalendarDays } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComposeBlockDialog } from "./ComposeBlockDialog";
import { TimeSelect } from "@/components/ui/time-select";
import { setDragCommitmentInfo, getDragCommitmentInfo } from "@/lib/dragStore";
import { SessionView } from "./SessionView";
import { calcProgress } from "@/lib/schedule/workspace-engine";
import type { WorkspaceStructure } from "@/lib/schedule/types";
import { HOUR_PX, STACK_GAP_PX, addDays, toIsoDate, isSameDay, formatHourLabel, formatClock, fmtFriendlyDuration, isBoundarySleepBlock, useNowMin, topFor, blockHeight, freeHeight, buildTimeline } from "@/lib/schedule/planner-format";
import type { FreeSlot } from "@/lib/schedule/planner-format";
import { BlockDetailsDialog } from "./planner/BlockDetailsDialog";
import { BlockEditDialog } from "./planner/BlockEditDialog";
import { SleepEditDialog } from "./planner/SleepEditDialog";
import { useDayPlannerDrag } from "./planner/useDayPlannerDrag";
import { parseNoteLine, parseNotes, serializeNotes, renderLinkedText, noteToneStyles } from "@/lib/schedule/planner-notes";
import type { NoteLine, NoteTone } from "@/lib/schedule/planner-notes";
import { TimelineGrid } from "./planner/TimelineGrid";
import { TimelineBlock } from "./planner/TimelineBlock";

export interface DayPlannerHandle {
  scrollToNow(): void;
  scrollToMinute(minute: number, block?: "start" | "center" | "end"): void;
}

interface DayPlannerProps {
  onCommitmentDrop?: (commitmentId: string, date: string, start: string) => void;
  assignGoalId?: string | null;
  onAssignMode?: (goalId: string | null) => void;
}

export const DayPlanner = forwardRef<DayPlannerHandle, DayPlannerProps>(function DayPlanner({ onCommitmentDrop, assignGoalId, onAssignMode }, ref) {
  const { data, pushMoveDayChain, updateRoutine, updateSleepSchedule, setSleepBoundaryEnforced, addSleepCut, removeSleepCut, removeRoutine, updateCommitment, removeCommitment, trackBlockForGoal, isBlockTrackedForAnyGoal } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const { bcp47 } = useI18n();
  const scheduleText = useScheduleText();
  const nowMin = useNowMin();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const isToday = isSameDay(selectedDate, new Date());

  const rawAgenda = buildAgendaForDate(data, selectedDate);
  const selectedDateIso = toIsoDate(selectedDate);
  const routineById = useMemo(() => new Map(data.routine.map((r) => [r.id, r])), [data.routine]);
  const commitmentById = useMemo(() => new Map(data.commitments.map((c) => [c.id, c])), [data.commitments]);
  const liveId = isToday
    ? rawAgenda.find((a) => timeToMinutes(a.start) <= nowMin && nowMin < timeToMinutes(a.end))?.id
    : undefined;

  const nonSleepAgenda = useMemo(
    () => rawAgenda.filter((a) => a.kind !== "sleep").sort((a, b) => a.start.localeCompare(b.start)),
    [rawAgenda],
  );

  // ── Sleep schedule for this day ─────────────────────────────────────────────
  const sleepSchedule = data.meta.sleepSchedule ?? [data.meta.sleepWindow ?? { start: "22:30", end: "07:00" }];
  const sleepEntry = getSleepWindowForDay(sleepSchedule, selectedDate.getDay());

  // When no sleep schedule entry matches this day, or start equals end (user cleared sleep),
  // there is no sleep boundary.
  const effectiveSleepEntry = sleepEntry && sleepEntry.start !== sleepEntry.end ? sleepEntry : null;
  const sleepStartMin = effectiveSleepEntry ? timeToMinutes(effectiveSleepEntry.start) : 0;
  const sleepEndMin   = effectiveSleepEntry ? timeToMinutes(effectiveSleepEntry.end) : 0;
  // Enforce sleep boundary when there's a valid sleep window (not explicitly disabled via meta)
  const enforceSleepBoundary = effectiveSleepEntry !== null && data.meta.enforceSleepBoundary !== false;
  const hasCrossDaySleep = enforceSleepBoundary && effectiveSleepEntry !== null && sleepStartMin > sleepEndMin;
  const hasSameDaySleep  = enforceSleepBoundary && effectiveSleepEntry !== null && sleepStartMin < sleepEndMin;
  const wakeOnlySleep = hasSameDaySleep && effectiveSleepEntry?.start === "00:00" && effectiveSleepEntry?.end !== "00:00";

  // Visual boundary markers
  const morningSleep = hasCrossDaySleep ? { start: "00:00", end: effectiveSleepEntry!.end } : null;
  const eveningSleep = hasCrossDaySleep ? { start: effectiveSleepEntry!.start, end: "24:00" } : null;
  const sameDaySleep = hasSameDaySleep && !wakeOnlySleep ? { start: effectiveSleepEntry!.start, end: effectiveSleepEntry!.end } : null;

  // Per-date sleep cuts (mid-day dividers)
  const sleepCutsForDay = useMemo(
    () => (data.meta.sleepCuts ?? [])
      .filter((c) => c.date === selectedDateIso)
      .sort((a, b) => a.start.localeCompare(b.start)),
    [data.meta.sleepCuts, selectedDateIso],
  );

  const defaultStartMin = timeToMinutes(data.meta.workdayStart);
  const defaultEndMin   = timeToMinutes(data.meta.workdayEnd);

  // Start: wake time (morning end of sleep) or workday start
  let startMin = hasCrossDaySleep ? sleepEndMin : defaultStartMin;
  // End: bed time (evening start of sleep) or workday end
  let endMin   = hasCrossDaySleep ? sleepStartMin : defaultEndMin;

  // ── Timeline boundaries ───────────────────────────────────────────────────
  // When overnight sleep is not enforced OR there is no effective sleep entry for
  // this day, keep the day frame stable at 00:00–24:00 so dragging crossday blocks
  // does not keep redefining the visible bottom edge.
  if (!effectiveSleepEntry || !enforceSleepBoundary) {
    startMin = 0;
    endMin = 24 * 60;
  }

  // Wake-only mode should shave the midnight-to-wake span off the top of the day.
  if (wakeOnlySleep) {
    startMin = sleepEndMin;
    endMin = 24 * 60;
  }

  // For same-day sleep, show the full sleep zone
  if (hasSameDaySleep && !wakeOnlySleep) {
    startMin = Math.min(startMin, sleepStartMin);
    endMin   = Math.max(endMin,   sleepEndMin);
  }

  if (enforceSleepBoundary) {
    // Expand to fit actual blocks only while the sleep frame is active.
    const firstWorkStart = nonSleepAgenda.length > 0 ? timeToMinutes(nonSleepAgenda[0].start) : defaultStartMin;
    const lastWorkEnd    = nonSleepAgenda.length > 0 ? timeToMinutes(nonSleepAgenda[nonSleepAgenda.length - 1].end) : defaultEndMin;
    startMin = Math.min(startMin, firstWorkStart);
    endMin   = Math.max(endMin,   lastWorkEnd);
  }

  // Expand to show all sleep cut zones
  if (sleepCutsForDay.length > 0) {
    const earliestCut = sleepCutsForDay[0];
    const latestCut = sleepCutsForDay[sleepCutsForDay.length - 1];
    startMin = Math.min(startMin, timeToMinutes(earliestCut.start));
    endMin = Math.max(endMin, timeToMinutes(latestCut.end));
  }

  // Safety: always show at least 1 hour
  if (endMin - startMin < 60) { startMin = defaultStartMin; endMin = defaultEndMin; }
  if (endMin - startMin < 60) { startMin = 0; endMin = 24 * 60; }

  // For today: ensure "now" is always in view (but stay within sleep boundary)
  if (isToday && enforceSleepBoundary && effectiveSleepEntry) {
    const boundStart = hasCrossDaySleep ? sleepEndMin : sleepStartMin;
    const boundEnd   = hasCrossDaySleep ? sleepStartMin : sleepEndMin;
    startMin = Math.min(startMin, Math.max(boundStart, nowMin - 60));
    endMin   = Math.max(endMin,   Math.min(boundEnd,   nowMin + 60));
  }

  const sleepSplits = useMemo(() => {
    return sleepCutsForDay
      .map((cut) => {
        const cutStartMin = timeToMinutes(cut.start);
        const cutEndMin = timeToMinutes(cut.end);
        if (cutEndMin <= cutStartMin) return null;
        const cutStart = Math.max(startMin, cutStartMin);
        const cutEnd = Math.min(endMin, cutEndMin);
        const durMin = cutEnd - cutStart;
        if (durMin < SNAP) return null;
        return {
          cut,
          startMin: cutStart,
          endMin: cutEnd,
          durMin,
          laneMin: Math.min(30, durMin),
        };
      })
      .filter((cut): cut is {
        cut: SleepCut;
        startMin: number;
        endMin: number;
        durMin: number;
        laneMin: number;
      } => Boolean(cut));
  }, [sleepCutsForDay, startMin, endMin]);

  const projectMinute = useCallback((minute: number) => {
    if (sleepSplits.length === 0) return minute;
    let hiddenBefore = 0;
    for (const cut of sleepSplits) {
      if (minute >= cut.endMin) {
        hiddenBefore += cut.durMin - cut.laneMin;
        continue;
      }
      if (minute > cut.startMin) {
        const ratio = (minute - cut.startMin) / cut.durMin;
        return cut.startMin - hiddenBefore + ratio * cut.laneMin;
      }
      return minute - hiddenBefore;
    }
    return minute - hiddenBefore;
  }, [sleepSplits]);

  const topForProjected = useCallback((time: string) => (
    (projectMinute(timeToMinutes(time)) - projectMinute(startMin)) / 60 * HOUR_PX
  ), [projectMinute, startMin]);

  const timeline = useMemo(() => {
    if (sleepSplits.length > 0) {
      const pieces: (AgendaItem | FreeSlot)[] = [];
      let cursor = startMin;
      for (const cut of sleepSplits) {
        if (cut.startMin - cursor >= SNAP) {
          pieces.push(...buildTimeline(nonSleepAgenda, cursor, cut.startMin));
        }
        cursor = Math.max(cursor, cut.endMin);
      }
      if (endMin - cursor >= SNAP) {
        pieces.push(...buildTimeline(nonSleepAgenda, cursor, endMin));
      }
      return pieces;
    }
    return buildTimeline(nonSleepAgenda, startMin, endMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(nonSleepAgenda as AgendaItem[]).map((a: AgendaItem) => `${a.id}|${a.start}|${a.end}|${a.kind}|${a.source}|${a.sourceId ?? ""}`).join(","), startMin, endMin, selectedDateIso, sleepSplits]);

  const totalHiddenSleepMinutes = sleepSplits.reduce((sum, cut) => sum + (cut.durMin - cut.laneMin), 0);
  const totalHeight = ((endMin - startMin - totalHiddenSleepMinutes) / 60) * HOUR_PX;
  const firstVisibleHour = Math.ceil(startMin / 60);
  const lastVisibleHour = Math.floor(endMin / 60);
  const hours = Array.from(
    { length: Math.max(0, lastVisibleHour - firstVisibleHour + 1) },
    (_, i) => firstVisibleHour + i,
  ).filter((h) => {
    const hourMin = h * 60;
    return !sleepSplits.some((cut) => hourMin > cut.startMin && hourMin < cut.endMin);
  });
  const clampedNowMin = Math.max(startMin, Math.min(nowMin, endMin));
  const projectedNowMin = projectMinute(clampedNowMin);
  const activeSleepSplit = sleepSplits.find((cut) => nowMin > cut.startMin && nowMin < cut.endMin) ?? null;
  const nowInsideSleepCut = Boolean(activeSleepSplit);
  const nowRenderMin = nowInsideSleepCut && activeSleepSplit
    ? projectMinute(activeSleepSplit.startMin) + activeSleepSplit.laneMin / 2
    : projectedNowMin;
  const isNowClamped = isToday && clampedNowMin !== nowMin;
  const topBadgeLane = 26;
  const showStartBoundaryMarker = startMin % 60 !== 0;
  const isPt = bcp47.toLowerCase().startsWith("pt");
  const hasWakeBoundary = Boolean(effectiveSleepEntry && effectiveSleepEntry.end !== "00:00");
  const hasBedtimeBoundary = Boolean(effectiveSleepEntry && effectiveSleepEntry.start !== "00:00");
  const showEndBoundaryMarker = hasBedtimeBoundary && effectiveSleepEntry !== null && timeToMinutes(effectiveSleepEntry.start) % 60 !== 0;
  const wakeBoundaryText = hasWakeBoundary
    ? (isPt ? `Acordar ${formatClock(effectiveSleepEntry!.end, bcp47)}` : `Wake ${formatClock(effectiveSleepEntry!.end, bcp47)}`)
    : (isPt ? "Sem horario de acordar" : "No wakeup time");
  const bedtimeBoundaryText = hasBedtimeBoundary
    ? (isPt ? `Dormir ${formatClock(effectiveSleepEntry!.start, bcp47)}` : `Bedtime ${formatClock(effectiveSleepEntry!.start, bcp47)}`)
    : (isPt ? "Sem horario de dormir" : "No bedtime");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [timelineMaxH, setTimelineMaxH] = useState(640);

  const [commitmentDropPos, setCommitmentDropPos] = useState<{ start: string; duration: number } | null>(null);

  const {
    dragState,
    draggingId,
    dragDeltaMin,
    dragLimitHint,
    dragTransitionHint,
    hasDraggedRef,
    onGripDown,
    clearDragState,
  } = useDayPlannerDrag({
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
  });

  const [editItem, setEditItem] = useState<AgendaItem | null>(null);
  const [editSleep, setEditSleep] = useState(false);
  const [inspectItem, setInspectItem] = useState<AgendaItem | null>(null);
  const [quickAccessItem, setQuickAccessItem] = useState<AgendaItem | null>(null);

  useEffect(() => {
    if (!isToday || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: Math.max(0, ((projectMinute(nowMin) - projectMinute(startMin)) / 60) * HOUR_PX + topBadgeLane - 200), behavior: "smooth" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const available = window.innerHeight - rect.top - 16;
      setTimelineMaxH(Math.max(240, Math.round(available)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function jumpToNow() {
    scrollRef.current?.scrollTo({
      top: Math.max(0, ((projectMinute(nowMin) - projectMinute(startMin)) / 60) * HOUR_PX + topBadgeLane - 200),
      behavior: "smooth",
    });
  }

  useImperativeHandle(ref, () => ({
    scrollToNow: jumpToNow,
    scrollToMinute(minute: number, block: "start" | "center" | "end" = "center") {
      if (!scrollRef.current) return;
      const top = ((projectMinute(minute) - projectMinute(startMin)) / 60) * HOUR_PX + topBadgeLane;
      const offset = block === "center" ? -100 : block === "end" ? 0 : -200;
      scrollRef.current.scrollTo({ top: Math.max(0, top + offset), behavior: "smooth" });
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [startMin, topBadgeLane]);

  // Drag management is handled by useDayPlannerDrag hook above

  function handleSave(patch: Partial<AgendaItem> & { titleCustom?: string; endsNextDay?: boolean }) {
    if (!editItem) return;
    const targetId = editItem.sourceId ?? editItem.id;
    const err = editItem.source === "routine"
      ? updateRoutine(targetId, patch)
      : updateCommitment(targetId, patch);
    if (err) {
      toast({ title: "Conflict", description: err });
      return;
    }
    toast({ title: t.common.save });
    setEditItem(null);
  }

  function handleRemove(a: AgendaItem) {
    const targetId = a.sourceId ?? a.id;
    if (a.source === "routine") removeRoutine(targetId); else removeCommitment(targetId);
    toast({ title: t.chronos.widgets.blockRemoved });
    setEditItem(null);
  }

  const dateLabel = isToday
    ? t.chronos.today.eyebrow
    : selectedDate.toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "short" });

  // Keep sleep controls pinned to stable top/bottom lanes.
  const bottomBadgeLane = 28;
  const timelineContentHeight = totalHeight + topBadgeLane;
  const timelineHeight = timelineContentHeight + bottomBadgeLane;

  const positionedTimeline = useMemo(() => {
    const rawDesired: number[] = [];
    const positions = timeline.map((item, index) => {
      const top = topForProjected(item.start) + topBadgeLane;
      const desiredHeight = "type" in item
        ? (item.type === "free"
          ? freeHeight(item.start, item.end)
          : Math.max(12, ((timeToMinutes(item.end) - timeToMinutes(item.start)) / 60) * HOUR_PX - 2))
        : blockHeight(item.start, item.end);
      rawDesired[index] = desiredHeight;
      const nextTop = index < timeline.length - 1
        ? topForProjected(timeline[index + 1].start) + topBadgeLane
        : timelineContentHeight;
      const maxHeightWithoutOverlap = Math.max(6, nextTop - top - STACK_GAP_PX);
      return { item, top, height: Math.min(desiredHeight, maxHeightWithoutOverlap) };
    });

    // If dragging, cascade subsequent blocks to preview the push-down effect.
    if (draggingId && dragState.current) {
      const dragItemIdx = positions.findIndex(
        (p) => "id" in p.item && (p.item as AgendaItem).id === draggingId,
      );
      if (dragItemIdx >= 0) {
        const ds = dragState.current;
        const draggedDragMin = ds.origStartMin + dragDeltaMin;
        const draggedStart = Math.max(0, draggedDragMin);
        const draggedEnd = Math.min(24 * 60, draggedDragMin + ds.origDurMin);
        const dragTop = topForProjected(snapTime(draggedStart)) + topBadgeLane;
        const dragBh = Math.max(6, ((draggedEnd - draggedStart) / 60) * HOUR_PX - 4);
        const cascadePositions = [...positions];
        cascadePositions[dragItemIdx] = {
          ...cascadePositions[dragItemIdx],
          top: dragTop,
          height: dragBh,
        };
        // No cascade during drag preview — only the dragged block moves freely.
        return cascadePositions;
      }
    }

    return positions;
  }, [timeline, topBadgeLane, timelineContentHeight, draggingId, dragDeltaMin, dragState, topForProjected]);

  return (
    <div className="chronos-card p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedDate((d) => addDays(d, -1))} className="h-8 w-8 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-secondary/50 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[160px] text-center">
            <div className="text-[10px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.dailyAgenda}</div>
            <div className="font-display text-lg text-primary leading-tight capitalize mt-0.5">{dateLabel}</div>
          </div>
          <button onClick={() => setSelectedDate((d) => addDays(d, +1))} className="h-8 w-8 rounded-md border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-secondary/50 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden md:inline num">
            {t.chronos.widgets.movements(rawAgenda.filter((a) => !isBoundarySleepBlock(a)).length)} · {fmtDur(rawAgenda.filter((a) => !isBoundarySleepBlock(a)).reduce((s, a) => s + durationMin(a.start, a.end), 0))}
          </span>
          {isToday ? (
            <Button variant="outline" size="sm" className="h-8" onClick={jumpToNow}>
              <Clock className="h-3.5 w-3.5 mr-1" />{t.chronos.today.jumpToNow}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setSelectedDate(new Date())}>
              {t.chronos.today.eyebrow}
            </Button>
          )}
          <ComposeBlockDialog defaultDay={selectedDate.getDay()} defaultDateIso={selectedDateIso} />
        </div>
      </div>

      {(() => {
        const isPt = bcp47.toLowerCase().startsWith("pt");
        const td = selectedDateIso;
        const dlGoals = data.goals.filter((g) => g.kind === "deadline" && g.deadline);
        if (dlGoals.length === 0) return null;
        const sorted = [...dlGoals].sort((a, b) => a.deadline!.localeCompare(b.deadline!));
        return (
          <div className="flex items-center gap-1.5 px-5 py-1.5 border-b border-border/40 overflow-x-auto">
            <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
            {sorted.slice(0, 3).map((g) => {
              const d = daysUntilDeadline(g.deadline!);
              const overdue = d < 0;
              const isDue = d === 0;
              return (
                <button key={g.id}
                  onClick={() => {
                    const el = document.querySelector(`[data-goal-id="${g.id}"]`);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth", block: "center" });
                      (el as HTMLElement).classList.add("ring-2", "ring-primary/30", "rounded-lg");
                      setTimeout(() => (el as HTMLElement).classList.remove("ring-2", "ring-primary/30", "rounded-lg"), 2000);
                    }
                  }}
                  className={`rounded-md border px-2 py-0.5 text-[11px] flex items-center gap-1.5 shrink-0 transition-colors hover:opacity-80 ${
                    overdue ? "border-rose-500/40 bg-rose-500/8 text-rose-600" :
                    isDue ? "border-rose-500/30 bg-rose-500/6 text-rose-600" :
                    d <= 3 ? "border-amber-500/30 bg-amber-500/6 text-amber-600" :
                    "border-border/60 text-muted-foreground"
                  }`}
                >
                  <span className="truncate max-w-[100px]">{g.title}</span>
                  <span className="num font-medium">
                    {overdue ? `${Math.abs(d)}d` : isDue ? t.chronos.today.eyebrow : `${d}d`}
                  </span>
                </button>
              );
            })}
            {sorted.length > 3 && (
              <span className="text-[10px] text-muted-foreground shrink-0">+{sorted.length - 3}</span>
            )}
          </div>
        );
      })()}

      <div
        id="dayplanner-scroll"
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: timelineMaxH }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          if (!e.dataTransfer.types.includes("application/x-chronos-commitment")) return;
          const info = getDragCommitmentInfo();
          if (!info) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const relativeY = e.clientY - rect.top + scrollRef.current!.scrollTop;
          const rawMinute = startMin + ((relativeY - topBadgeLane) / HOUR_PX) * 60;
          const snapped = snapTime(Math.round(rawMinute / SNAP) * SNAP);
          setCommitmentDropPos({ start: snapped, duration: info.dur });
        }}
        onDragLeave={() => setCommitmentDropPos(null)}
        onDrop={(e) => {
          e.preventDefault();
          setCommitmentDropPos(null);
          const info = getDragCommitmentInfo();
          setDragCommitmentInfo(null);
          if (!info) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const relativeY = e.clientY - rect.top + scrollRef.current!.scrollTop;
          const rawMinute = startMin + ((relativeY - topBadgeLane) / HOUR_PX) * 60;
          const snapped = snapTime(Math.round(rawMinute / SNAP) * SNAP);
          onCommitmentDrop?.(info.id, selectedDateIso, snapped);
        }}
      >
        {assignGoalId && (() => {
          const ag = data.goals.find((g) => g.id === assignGoalId);
          if (!ag) return null;
          return (
            <div className="flex items-center justify-between bg-secondary/10 border-b border-secondary/30 px-5 py-2">
              <span className="text-xs text-primary font-medium">
                Assigning blocks to <span className="text-secondary">{ag.title}</span>
              </span>
              <button onClick={() => onAssignMode?.(null)}
                className="text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded hover:bg-muted/50 transition-colors"
              >
                Exit
              </button>
            </div>
          );
        })()}
        <TimelineGrid
          isToday={isToday}
          projectedNowMin={projectedNowMin}
          nowRenderMin={nowRenderMin}
          nowInsideSleepCut={nowInsideSleepCut}
          isNowClamped={isNowClamped}
          projectMinute={projectMinute}
          topBadgeLane={topBadgeLane}
          hours={hours}
          startMin={startMin}
          HOUR_PX={HOUR_PX}
          timelineHeight={timelineHeight}
          timelineContentHeight={timelineContentHeight}
          sleepSplits={sleepSplits}
          bcp47={bcp47}
          formatClock={formatClock}
          formatHourLabel={formatHourLabel}
          showStartBoundaryMarker={showStartBoundaryMarker}
          showEndBoundaryMarker={showEndBoundaryMarker}
          wakeBoundaryText={wakeBoundaryText}
          bedtimeBoundaryText={bedtimeBoundaryText}
          draggingId={draggingId}
          nonSleepAgenda={nonSleepAgenda}
          nowMin={nowMin}
          commitmentDropPos={commitmentDropPos}
          topForProjected={topForProjected}
          STACK_GAP_PX={STACK_GAP_PX}
          onEditSleep={() => setEditSleep(true)}
        />
        <div className="absolute left-[68px] right-4 top-0 bottom-0 z-10">
          {positionedTimeline.map(({ item, top, height }) => (
            <TimelineBlock
              key={item.id}
              item={item}
              top={top}
              height={height}
              data={data}
              routineById={routineById}
              commitmentById={commitmentById}
              bcp47={bcp47}
              fmtDur={fmtDur}
              scheduleText={scheduleText}
              t={t}
              topBadgeLane={topBadgeLane}
              topForProjected={topForProjected}
              timelineContentHeight={timelineContentHeight}
              selectedDate={selectedDate}
              selectedDateIso={selectedDateIso}
              draggingId={draggingId}
              dragDeltaMin={dragDeltaMin}
              dragState={dragState}
              dragLimitHint={dragLimitHint}
              dragTransitionHint={dragTransitionHint}
              hasDraggedRef={hasDraggedRef}
              liveId={liveId}
              assignGoalId={assignGoalId}
              trackBlockForGoal={trackBlockForGoal}
              isBlockTrackedForAnyGoal={isBlockTrackedForAnyGoal}
              onGripDown={onGripDown}
              onEditItem={(a) => setEditItem(a)}
              onInspectItem={(a) => setInspectItem(a)}
              onEditSleep={() => setEditSleep(true)}
            />
          ))}
          {rawAgenda.filter((a) => !isBoundarySleepBlock(a)).length === 0 && (
            <div className="absolute inset-x-0 top-24 mx-auto max-w-xs rounded-lg border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">{t.chronos.today.noBlocks}</p>
              <div className="mt-3"><ComposeBlockDialog defaultDay={selectedDate.getDay()} defaultDateIso={selectedDateIso} /></div>
            </div>
          )}
        </div>
      </div>

      {editItem && (
        <BlockEditDialog
          item={editItem}
          categories={data.categories}
          onSave={handleSave}
          onRemove={() => handleRemove(editItem)}
          onClose={() => setEditItem(null)}
        />
      )}
      {editSleep && (
        <SleepEditDialog
          sleepWindow={sleepEntry ? { start: sleepEntry.start ?? "22:00", end: sleepEntry.end ?? "07:00", days: sleepEntry.days ?? [selectedDate.getDay()] } : { start: "22:00", end: "07:00", days: [selectedDate.getDay()] }}
          dayLabel={selectedDate.toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "short" })}
          dateIso={selectedDateIso}
          sleepCuts={sleepCutsForDay}
          onSaveWindow={(patch) => {
            const dow = selectedDate.getDay();
            let nextSchedule: SleepScheduleEntry[];
            if (patch.applyToAllDays) {
              nextSchedule = [{ start: patch.start, end: patch.end }];
            } else {
              const prevSchedule = data.meta.sleepSchedule ?? [];
              const hasSpecificEntry = prevSchedule.some((e) => e.days?.includes(dow));
              if (hasSpecificEntry) {
                nextSchedule = prevSchedule.map((e): SleepScheduleEntry =>
                  e.days?.includes(dow) ? { ...e, start: patch.start, end: patch.end } : e
                );
              } else {
                const allDay = prevSchedule.find((e) => !e.days);
                if (allDay) {
                  nextSchedule = [{ start: patch.start, end: patch.end, days: [dow] }, ...prevSchedule];
                } else {
                  nextSchedule = [...prevSchedule, { start: patch.start, end: patch.end, days: [dow] }];
                }
              }
            }
            updateSleepSchedule(nextSchedule);
            setSleepBoundaryEnforced(patch.start !== "00:00" || patch.end !== "00:00");
            setEditSleep(false);
          }}
          onAddOrUpdateSleepCut={(cut) => {
            if (cut.previous) {
              removeSleepCut(cut.previous);
            }
            addSleepCut({ date: selectedDateIso, start: cut.start, end: cut.end });
          }}
          onRemoveSleepCut={(cut) => {
            removeSleepCut(cut);
          }}
          onClose={() => setEditSleep(false)}
        />
      )}
      {inspectItem && (
        <BlockDetailsDialog
          item={inspectItem}
          onEdit={() => {
            setEditItem(inspectItem);
            setInspectItem(null);
          }}
          onClose={() => setInspectItem(null)}
        />
      )}
      {quickAccessItem && (() => {
        const cat = data.categories.find((c) => c.id === quickAccessItem.kind);
        const structure = cat?.workspace;
        if (!structure) return null;
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setQuickAccessItem(null); }}>
            <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[min(80vh,calc(100dvh-3rem))] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-base">
                  <span>{cat?.label ?? quickAccessItem.kind}</span>
                  {cat?.workspace && (() => {
                    const liveRuntime =
                      quickAccessItem.source === "commitment"
                        ? (data.commitments.find((c) => c.id === quickAccessItem.id)?.workspace ?? {})
                        : (data.routine.find((r) => r.id === (quickAccessItem.sourceId ?? quickAccessItem.id))?.workspace ?? {});
                    const { done, total } = calcProgress(liveRuntime, cat.workspace);
                    if (total === 0) return null;
                    const pct = Math.round((done / total) * 100);
                    return (
                      <span className="ml-auto flex items-center gap-2 shrink-0">
                        <svg viewBox="0 0 32 32" className="w-7 h-7 -rotate-90">
                          <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                          <circle
                            cx="16" cy="16" r="13"
                            fill="none"
                            stroke="hsl(var(--secondary))"
                            strokeWidth="3"
                            strokeDasharray={`${2 * Math.PI * 13}`}
                            strokeDashoffset={`${2 * Math.PI * 13 * (1 - pct / 100)}`}
                            strokeLinecap="round"
                            className="transition-all duration-300"
                          />
                        </svg>
                        <span className="text-xs text-muted-foreground num">{done}/{total}</span>
                      </span>
                    );
                  })()}
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-x-auto min-w-0">
                <SessionView
                  structure={structure}
                  runtime={
                    quickAccessItem.source === "commitment"
                      ? (data.commitments.find((c) => c.id === quickAccessItem.id)?.workspace ?? {})
                      : (data.routine.find((r) => r.id === (quickAccessItem.sourceId ?? quickAccessItem.id))?.workspace ?? {})
                  }
                  onChange={(newExt) => {
                    if (quickAccessItem.source === "commitment") {
                      updateCommitment(quickAccessItem.id, { workspace: newExt });
                    } else {
                      updateRoutine(quickAccessItem.id, { workspace: newExt });
                    }
                  }}
                  onClose={() => setQuickAccessItem(null)}
                />
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
});


