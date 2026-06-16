import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef } from "react";
import { useSchedule, buildAgendaForDate, getSleepWindowForDay } from "@/lib/schedule/store";
import { BlockKind, SNAP, snapTime, clockTimeFromMin, durationMin, timeToMinutes, fmtDur, daysUntilDeadline } from "@/lib/schedule/types";
import type { SleepCut, SleepScheduleEntry } from "@/lib/schedule/types";
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
import { SessionView, BlockSessionBadge } from "./SessionView";
import { calcProgress } from "@/lib/schedule/workspace-engine";
import type { WorkspaceStructure } from "@/lib/schedule/types";

const HOUR_PX = 64;
const STACK_GAP_PX = 4;

type AgendaItem = {
  id: string;
  sourceId?: string;
  title: string;
  titleCustom?: string;
  start: string;
  end: string;
  kind: BlockKind;
  source: "routine" | "commitment";
  notes?: string;
  derived?: boolean;
  continuesFromPrevDay?: boolean;
  continuesToNextDay?: boolean;
  workspace?: Record<string, unknown>;
};

type FreeSlot = { type: "free"; id: string; start: string; end: string };

function fmtPreviewMinutes(totalMin: number, isPt: boolean) {
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0 && minutes > 0) return isPt ? `${hours}h ${minutes}min` : `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return isPt ? `${minutes}min` : `${minutes}m`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function formatHourLabel(hour24: number, bcp47: string) {
  const d = new Date();
  d.setHours(hour24, 0, 0, 0);
  return d.toLocaleTimeString(bcp47, { hour: "2-digit", minute: "2-digit" });
}

function formatClock(time: string, bcp47: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(bcp47, { hour: "numeric", minute: "2-digit" });
}

function isBoundarySleepBlock(a: AgendaItem) {
  return a.kind === "sleep" && Boolean((a as AgendaItem & { sleepBoundary?: boolean }).sleepBoundary);
}

type NoteTone = "amber" | "sky" | "emerald" | "rose" | "violet";

type NoteLine = {
  text: string;
  tone: NoteTone;
};

const noteToneStyles: Record<NoteTone, { bg: string; border: string; text: string; chip: string; solid: string }> = {
  amber: {
    bg: "bg-amber-500/12",
    border: "border-amber-500/25",
    text: "text-amber-900 dark:text-amber-100",
    chip: "bg-amber-500/20 text-amber-700 dark:text-amber-200",
    solid: "bg-amber-500",
  },
  sky: {
    bg: "bg-sky-500/12",
    border: "border-sky-500/25",
    text: "text-sky-900 dark:text-sky-100",
    chip: "bg-sky-500/20 text-sky-700 dark:text-sky-200",
    solid: "bg-sky-500",
  },
  emerald: {
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/25",
    text: "text-emerald-900 dark:text-emerald-100",
    chip: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200",
    solid: "bg-emerald-500",
  },
  rose: {
    bg: "bg-rose-500/12",
    border: "border-rose-500/25",
    text: "text-rose-900 dark:text-rose-100",
    chip: "bg-rose-500/20 text-rose-700 dark:text-rose-200",
    solid: "bg-rose-500",
  },
  violet: {
    bg: "bg-violet-500/12",
    border: "border-violet-500/25",
    text: "text-violet-900 dark:text-violet-100",
    chip: "bg-violet-500/20 text-violet-700 dark:text-violet-200",
    solid: "bg-violet-500",
  },
};

function parseNoteLine(raw: string): NoteLine {
  const trimmed = raw.trim();
  const explicit = trimmed.match(/^(amber|yellow|sky|blue|emerald|green|rose|red|violet|purple)\s*:\s*(.+)$/i);
  if (explicit) {
    const token = explicit[1].toLowerCase();
    const text = explicit[2].trim();
    const tone: NoteTone =
      token === "yellow" ? "amber"
      : token === "blue" ? "sky"
      : token === "green" ? "emerald"
      : token === "red" ? "rose"
      : token === "purple" ? "violet"
      : (token as NoteTone);
    return { text, tone };
  }
  return { text: trimmed, tone: "amber" };
}

function parseNotes(notes?: string) {
  return (notes ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseNoteLine(line));
}

function serializeNotes(lines: NoteLine[]) {
  return lines
    .map((line) => ({
      text: line.text.trim(),
      tone: line.tone,
    }))
    .filter((line) => line.text.length > 0)
    .map((line) => (line.tone === "amber" ? line.text : `${line.tone}: ${line.text}`))
    .join("\n");
}

function renderLinkedText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/gi);
  return parts.map((part, index) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          data-no-open="true"
          onClick={(e) => e.stopPropagation()}
          className="underline underline-offset-2 hover:text-primary"
        >
          {part}
        </a>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function buildTimeline(agenda: AgendaItem[], dayStart: number, dayEnd: number): (AgendaItem | FreeSlot)[] {
  const sorted = [...agenda].sort((a, b) => a.start.localeCompare(b.start));
  const result: (AgendaItem | FreeSlot)[] = [];
  let cursor = dayStart;

  for (const block of sorted) {
    const bs = timeToMinutes(block.start);
    const be = timeToMinutes(block.end);
    if (be <= dayStart || bs >= dayEnd) continue;

    const clippedStart = Math.max(dayStart, bs);
    const clippedEnd = Math.min(dayEnd, be);

    if (clippedStart - cursor >= SNAP) {
      result.push({ type: "free", id: `free-${cursor}`, start: snapTime(cursor), end: snapTime(clippedStart) });
    }

    result.push({ ...block, start: snapTime(clippedStart), end: snapTime(clippedEnd) });
    cursor = Math.max(cursor, clippedEnd);
  }

  if (dayEnd - cursor >= SNAP) {
    result.push({ type: "free", id: `free-${cursor}`, start: snapTime(cursor), end: snapTime(dayEnd) });
  }
  return result;
}

function topFor(t: string, startMin: number) {
  return ((timeToMinutes(t) - startMin) / 60) * HOUR_PX;
}

function blockHeight(s: string, e: string) {
  // Keep tiny blocks slightly taller so compact metadata aligns better.
  return Math.max(20, ((timeToMinutes(e) - timeToMinutes(s)) / 60) * HOUR_PX - 4);
}

function freeHeight(s: string, e: string) {
  return Math.max(8, ((timeToMinutes(e) - timeToMinutes(s)) / 60) * HOUR_PX - 2);
}

function useNowMin() {
  const [n, setN] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setN(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return n;
}

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

  const dragState = useRef<{
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
  } | null>(null);
  const [dragDeltaMin, setDragDeltaMin] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragDeltaRef = useRef(0);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [dragLimitHint, setDragLimitHint] = useState<string | null>(null);
  const [dragTransitionHint, setDragTransitionHint] = useState<{ edge: "top" | "bottom"; direction: "up" | "down"; pending: boolean } | null>(null);
  const hasDraggedRef = useRef(false);
  const [commitmentDropPos, setCommitmentDropPos] = useState<{ start: string; duration: number } | null>(null);

  const [editItem, setEditItem] = useState<AgendaItem | null>(null);
  const [editSleep, setEditSleep] = useState(false);
  const [inspectItem, setInspectItem] = useState<AgendaItem | null>(null);
  const [quickAccessItem, setQuickAccessItem] = useState<AgendaItem | null>(null);

  function BlockBadges({ a, tier }: { a: AgendaItem; tier: "micro" | "compact" | "hour" | "full" }) {
    const cat = data.categories.find((c) => c.id === a.kind);
    if (!cat?.workspace) return null;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setQuickAccessItem(a); }}
        className="shrink-0 rounded transition-colors hover:bg-black/6 dark:hover:bg-white/6 -mr-0.5"
        style={{ padding: tier === "micro" ? "1px 3px" : "2px 4px" }}
        title="Open session"
      >
        <BlockSessionBadge structure={cat.workspace} runtime={
          a.source === "routine"
            ? (data.routine.find(r => r.id === (a.sourceId ?? a.id))?.workspace ?? {})
            : (data.commitments.find(c => c.id === a.id)?.workspace ?? {})
        } tier={tier} />
      </button>
    );
  }

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

  useEffect(() => {
    return () => {
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
        dragCleanupRef.current = null;
      }
    };
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

  function clearDragState() {
    dragState.current = null;
    setDraggingId(null);
    setDragDeltaMin(0);
    dragDeltaRef.current = 0;
    setDragLimitHint(null);
    setDragTransitionHint(null);
  }

  // ── Unified crossday drag thresholds ─────────────────────────────────────
  // TEASE_MIN: how far past midnight before showing the glow-arrow hint
  // COMMIT_MIN: how far past midnight before solidifying a crossday split
  // MIN_IN_DAY: minimum minutes that must remain in the originating day
  const TEASE_MIN  = 15; // minutes past 00:00 → show glow hint (pending = true)
  const COMMIT_MIN = 30; // minutes past 00:00 → solidify crossday
  const MIN_IN_DAY = 15; // minimum minutes that must stay in the originating day

  const sleepCutsToRanges = (dateIso: string) =>
    (data.meta.sleepCuts ?? [])
      .filter((c) => c.date === dateIso)
      .map((c) => ({ start: timeToMinutes(c.start), end: timeToMinutes(c.end) }))
      .filter((c) => c.end > c.start)
      .sort((a, b) => a.start - b.start);

  const intersectsSleepCut = (start: number, end: number, ranges: Array<{ start: number; end: number }>) =>
    ranges.some((c) => start < c.end && end > c.start);

  const clampStartAvoidingSleepCuts = (
    candidateStart: number,
    dur: number,
    minStart: number,
    maxStart: number,
    ranges: Array<{ start: number; end: number }>,
    preferForward: boolean,
  ) => {
    let nextStart = Math.max(minStart, Math.min(candidateStart, maxStart));
    let guard = 0;
    while (guard < ranges.length + 3) {
      guard += 1;
      const nextEnd = nextStart + dur;
      const overlap = ranges.find((c) => nextStart < c.end && nextEnd > c.start);
      if (!overlap) return nextStart;

      const beforeStart = Math.max(minStart, Math.min(nextStart, overlap.start - dur));
      const beforeEnd = beforeStart + dur;
      const beforeValid = beforeStart >= minStart && beforeEnd <= maxStart + dur && !intersectsSleepCut(beforeStart, beforeEnd, ranges);

      const afterStart = Math.min(maxStart, Math.max(nextStart, overlap.end));
      const afterEnd = afterStart + dur;
      const afterValid = afterStart <= maxStart && afterEnd <= maxStart + dur && !intersectsSleepCut(afterStart, afterEnd, ranges);

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

  function updateDragPreview(rawDeltaMin: number) {
    if (!dragState.current) return;
    const isPt = bcp47.toLowerCase().startsWith("pt");
    const todaySleepCuts = sleepCutsToRanges(selectedDateIso);
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
      const err = pushMoveDayChain(selectedDate, source, sourceId, newStart, newEnd, snappedDelta, "bottom");
      if (err) toast({ title: "Conflict", description: err });
      return;
    }

    if (transitionEdge === "top") {
      const absoluteStart = origStartMin + snappedDelta;
      const newStart = clockTimeFromMin(absoluteStart);
      const newEnd = clockTimeFromMin(absoluteStart + origDurMin);
      const err = pushMoveDayChain(selectedDate, source, sourceId, newStart, newEnd, snappedDelta, "top");
      if (err) toast({ title: "Conflict", description: err });
    }
  }
  function onGripDown(e: React.PointerEvent, a: AgendaItem) {
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
    const nextDayCutStart = sleepCutsToRanges(nextDayIso).reduce((min, c) => Math.min(min, c.start), 24 * 60);
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
    const prevDayCutEnd = sleepCutsToRanges(prevDayIso).reduce((max, c) => Math.max(max, c.end), 0);
    const prevDayCapacityCuts = 24 * 60 - prevDayCutEnd;
    const prevDayCapacity = Math.min(prevDayCapacityBlocks, prevDayCapacityCuts);

    // Top-origin crossday blocks are represented relative to the selected day.
    const origStartMin = transitionEdge === "top" ? timeToMinutes(sourceStart) - 24 * 60 : timeToMinutes(sourceStart);
    const origDurMin = sourceDurMin;

    const maxCurrentDaySpill = Math.max(0, origDurMin - MIN_IN_DAY);
    // Cross-day blocks of any edge must leave at least MIN_IN_DAY minutes on the
    // originating day. Both directions cap at maxCurrentDaySpill.
    const maxPrevSpillMin = transitionEdge === "top"
      ? Math.max(0, Math.min(Math.abs(origStartMin) + origDurMin, maxCurrentDaySpill))
      : Math.max(0, Math.min(maxCurrentDaySpill, prevDayCapacity));
    // Bottom-edge blocks that already span to the next day can extend further
    const maxNextSpillMin = sourceSpansNextDay
      ? origDurMin
      : Math.min(maxCurrentDaySpill, nextDayCapacity);
    const prevLimitKind: "block" | "sleep" | "min-current" = prevDayCapacity < maxCurrentDaySpill
      ? (prevDayCapacityCuts <= prevDayCapacityBlocks ? "sleep" : "block")
      : "min-current";
    const nextLimitKind: "block" | "sleep" | "min-current" = nextDayCapacity < maxCurrentDaySpill
      ? (hasNextDayOvernightSleep && nextDayWake === nextDayCapacity ? "sleep" : "block")
      : "min-current";
    // Cross-day blocks bypass the day's sleep boundaries for drag constraints
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
      // Reset hasDraggedRef after onClick has had a chance to fire
      setTimeout(() => { hasDraggedRef.current = false; }, 0);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerDone, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerDone);
    };
  }

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
        <div className="relative" style={{ height: timelineHeight, userSelect: draggingId ? "none" : undefined }}>
          {showStartBoundaryMarker && (
            <div
              className="absolute left-0 right-0 border-t border-border/40 pointer-events-none"
              style={{ top: topBadgeLane }}
            />
          )}
          {showEndBoundaryMarker && (
            <div
              className="absolute left-0 right-0 border-t border-border/40 pointer-events-none"
              style={{ top: timelineContentHeight }}
            />
          )}
          {hours.map((h) => {
            const hideLabel = isToday && projectMinute(h * 60) === projectedNowMin;
            const isFirstHourLine = h === hours[0];
            const hourTop = ((projectMinute(h * 60) - projectMinute(startMin)) / 60) * HOUR_PX + topBadgeLane;
            return (
              <div key={h}>
                <div className="absolute left-0 right-0 border-t border-border/30 pointer-events-none" style={{ top: hourTop }}>
                  {!hideLabel && (
                    <span className={`absolute left-3 text-[10px] num text-muted-foreground/50 bg-card px-1 ${isFirstHourLine ? "top-1" : "-top-2"}`}>{formatHourLabel(h, bcp47)}</span>
                  )}
                </div>
                {[15, 30, 45].map((q) => {
                  const qMin = h * 60 + q;
                  const inSleepCut = sleepSplits.some((cut) => qMin > cut.startMin && qMin < cut.endMin);
                  if (inSleepCut) return null;
                  return (
                    <div
                      key={`q-${h}-${q}`}
                      className="absolute left-[68px] right-4 border-t border-border/10 pointer-events-none"
                      style={{ top: ((projectMinute(qMin) - projectMinute(startMin)) / 60) * HOUR_PX + topBadgeLane }}
                    />
                  );
                })}
              </div>
            );
          })}

          {isToday && (
            <>
              <div
                className="absolute left-[68px] right-4 z-[32] pointer-events-none -translate-y-1/2"
                style={{ top: ((nowRenderMin - projectMinute(startMin)) / 60) * HOUR_PX + topBadgeLane }}
              >
                {nowInsideSleepCut
                  ? <div className="h-[3px] w-16 rounded-full bg-gradient-to-r from-primary/85 via-primary/60 to-transparent" />
                  : isNowClamped
                  ? <div className="h-[3px] w-16 rounded-full bg-gradient-to-r from-primary/85 via-primary/60 to-transparent" />
                  : (draggingId !== null || nonSleepAgenda.some((a) => timeToMinutes(a.start) <= nowMin && nowMin < timeToMinutes(a.end))
                    ? <div className="h-[3px] w-7 rounded-full bg-primary/80" />
                    : <div className="h-[3px] w-full rounded-full bg-primary/80" />)}
              </div>
              <div
                className="absolute left-2 z-[33] pointer-events-none"
                style={{ top: ((nowRenderMin - projectMinute(startMin)) / 60) * HOUR_PX + topBadgeLane }}
              >
                <div className="relative -translate-y-1/2 flex flex-row-reverse items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-card" />
                  <span className="text-[10px] num font-medium text-primary bg-card/95 border border-primary/40 px-1 rounded shadow-sm">
                    {`${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── SLEEP BOUNDARY BADGES (top / bottom) ─────────────────────────
               Small pill buttons at the edges, like before. Clicking opens
               the global sleepWindow editor. */}

          <div className="absolute left-[68px] right-4 z-[20]" style={{ top: 2, height: topBadgeLane }}>
            <button
              onClick={() => setEditSleep(true)}
              className="absolute right-0 bottom-[4px] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
            >
              {wakeBoundaryText}
            </button>
          </div>
          <div
            className="absolute left-[68px] right-4 z-[20]"
            style={{ top: timelineContentHeight + 4 }}
          >
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => setEditSleep(true)}
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
              >
                {bedtimeBoundaryText}
              </button>
            </div>
          </div>
          {/* ── SLEEP CUT DIVIDER (mid-day, per-date) ────────────────────────
            A full-width bar that splits the timeline into two segments.
            Clicking opens the day sleep editor. */}
          {sleepSplits.map((sleepSplit, index) => {
            const splitTop = topForProjected(snapTime(sleepSplit.startMin)) + topBadgeLane;
            const isPt = bcp47.toLowerCase().startsWith("pt");
            const splitBottom = topForProjected(snapTime(sleepSplit.endMin)) + topBadgeLane;
            const splitAvailable = Math.max(0, splitBottom - splitTop);
            const splitTarget = Math.max(30, splitAvailable - 2);
            const splitHeight = Math.min(splitTarget, splitAvailable);
            // Center against neighboring card outlets (not raw lane edges)
            // so the visual gap above and below the Sono strip matches.
            const centeredTop = (splitBottom + splitTop - STACK_GAP_PX - splitHeight) / 2;
            const splitTopOffset = Math.max(splitTop - STACK_GAP_PX, Math.min(centeredTop, splitBottom - splitHeight));
            return (
              <button
                key={`${sleepSplit.cut.date}-${sleepSplit.cut.start}-${sleepSplit.cut.end}-${index}`}
                onClick={() => setEditSleep(true)}
                className="group absolute left-[68px] right-4 z-[25] rounded-md border border-dashed border-primary/35 bg-muted/45 text-primary/85 hover:bg-muted/65 hover:border-primary/50 transition-colors"
                style={{ top: splitTopOffset, height: splitHeight }}
                aria-label={isPt ? "Editar pausa de sono" : "Edit sleep break"}
              >
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider num pointer-events-none">
                  <span className="font-medium">{isPt ? "Pausa" : "Break"}</span>
                  <span className="opacity-75">{formatClock(sleepSplit.cut.start, bcp47)}–{formatClock(sleepSplit.cut.end, bcp47)}</span>
                </div>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-full flex items-center justify-center text-primary/55 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <Pencil className="h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}



          <div className="absolute left-[68px] right-4 top-0 bottom-0 z-10">
            {commitmentDropPos && (
              <>
                {/* Glow line at the top of the drop position */}
                <div
                  className="absolute left-0 right-0 z-30 pointer-events-none"
                  style={{
                    top: topForProjected(commitmentDropPos.start) + topBadgeLane,
                    height: 0,
                    borderTop: "2px solid rgba(251, 191, 36, 0.6)",
                    boxShadow: "0 0 12px rgba(251, 191, 36, 0.35)",
                  }}
                />
                {/* Left arrow indicator */}
                <div
                  className="absolute z-30 pointer-events-none flex items-center justify-center rounded-full bg-card border border-amber-500/30"
                  style={{
                    left: -10,
                    top: topForProjected(commitmentDropPos.start) + topBadgeLane - 10,
                    height: 20,
                    width: 20,
                  }}
                >
                  <ArrowRightToLine className="h-3.5 w-3.5 text-amber-500/80" />
                </div>
              </>
            )}
            {positionedTimeline.map(({ item, top, height }) => {
              if ("type" in item && item.type === "free") {
                const fh = height;
                const dur = durationMin(item.start, item.end);
                // Scale + button to slot height, capped 10–20px
                const btnSize = Math.max(10, Math.min(Math.floor((fh - 4) / 2) * 2, 20));
                const btnIconSize = Math.round(btnSize * 0.55);
                return (
                  <div
                    key={item.id}
                    className={`absolute left-0 right-0 rounded-lg border border-dashed border-border/40 bg-card/80 flex items-center ${fh >= 32 ? "px-2" : "px-1"}`}
                    style={{ top, height: fh }}
                  >
                    {fh > 24 && (
                      <span className="text-[10px] text-muted-foreground/45 uppercase tracking-wider flex-1 truncate pr-7">
                        {t.chronos.today.free} · {fmtDur(dur)}
                      </span>
                    )}
                    {fh >= 12 && (
                      <ComposeBlockDialog
                        defaultStart={item.start}
                        defaultEnd={item.end}
                        defaultDay={selectedDate.getDay()}
                        defaultDateIso={selectedDateIso}
                        trigger={
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-7 flex justify-center" style={{ lineHeight: 1 }}>
                            <button
                              className="flex-shrink-0 rounded border border-dashed border-secondary/30 text-secondary/60 hover:text-secondary hover:border-secondary grid place-items-center transition-colors"
                              style={{ width: btnSize, height: btnSize }}
                            >
                              <Plus style={{ width: btnIconSize, height: btnIconSize }} />
                            </button>
                          </div>
                        } />
                    )}
                  </div>
                );
              }

              const a = item as AgendaItem;
              const blockCat = data.categories.find((c) => c.id === a.kind);
              const catColor = toCssColor(blockCat?.color);
              const hasColor = !!catColor;
              const catBlockStyle = hasColor ? { backgroundColor: alpha(catColor, "18"), borderColor: alpha(catColor, "40") } as const : undefined;
              const catChipStyle = hasColor ? { backgroundColor: alpha(catColor, "22"), color: catColor } as const : undefined;
              const catChipLabel = blockCat
                ? scheduleText.categoryLabel(a.kind, blockCat.label, blockCat.labelCustom)
                : t.common.kinds[a.kind];
              const sm = timeToMinutes(a.start);
              const em = timeToMinutes(a.end);
              const blockMinutes = Math.max(0, em - sm);
              let displayStart = a.start;
              let displayEnd = a.end;
              let displaySpansNextDay = a.end <= a.start;
              if (a.source === "routine" && a.sourceId) {
                const src = routineById.get(a.sourceId);
                if (src) {
                  displayStart = src.start;
                  displayEnd = src.end;
                  displaySpansNextDay = src.endsNextDay ?? src.end <= src.start;
                }
              }
              if (a.source === "commitment" && a.sourceId) {
                const src = commitmentById.get(a.sourceId);
                if (src) {
                  displayStart = src.start;
                  displayEnd = src.end;
                  displaySpansNextDay = src.endsNextDay ?? (Boolean(src.endDate && src.endDate > src.date) || src.end <= src.start);
                }
              }
              const displayDur = durationMin(displayStart, displayEnd);
              const isDragging = draggingId === a.id;
              const preOffset = top - (topForProjected(a.start) + topBadgeLane);
              let effectiveTop = isDragging ? topForProjected(snapTime(sm + dragDeltaMin)) + topBadgeLane + preOffset : top;
              let bh = height;
              const s = safeKindStyle(a.kind, data.categories);
              const live = a.id === liveId;

              if (isDragging && dragState.current && dragState.current.sourceId === (a.sourceId ?? a.id)) {
                const draggedSourceStart = dragState.current.origStartMin + dragDeltaMin;
                const draggedSourceEnd = draggedSourceStart + dragState.current.origDurMin;
                const visibleStart = Math.max(0, draggedSourceStart);
                const visibleEnd = Math.min(24 * 60, draggedSourceEnd);

                if (visibleEnd <= visibleStart) {
                  // Block has fully crossed midnight. Pin at the correct boundary edge so the
                  // transform transition doesn't animate the block across the full timeline.
                  const isTopEdge = dragState.current.transitionEdge === "top";
                  effectiveTop = isTopEdge
                    ? topBadgeLane
                    : timelineContentHeight + topBadgeLane - 3;
                  bh = 6;
                } else {
                  effectiveTop = topForProjected(snapTime(visibleStart)) + topBadgeLane;
                  bh = Math.max(12, ((visibleEnd - visibleStart) / 60) * HOUR_PX - 4);
                }
              }

              // ── Block size tiers ──────────────────────────────────────────
              // "full"    ≥75 min  → full layout: time row + chip + title + notes below
              // "hour"    60 min   → chip + title inline, notes as pills to the right
              // "compact" 30 min   → chip + title + compact time meta on right; no notes below
              // "micro"   ≤15 min  → single dense row: color square + title + sticky icon
              const tier: "full" | "hour" | "compact" | "micro" =
                blockMinutes >= 75 ? "full"
                : blockMinutes === 60 ? "hour"
                : blockMinutes <= 15 ? "micro"
                : "compact"; // 30 and 45

              const noteLines = parseNotes(a.notes);
              const hasNotes = noteLines.length > 0;
              const flatTop = Boolean(a.continuesFromPrevDay);
              const flatBottom = Boolean(a.continuesToNextDay);
              const firstNoteTone = hasNotes ? noteLines[0].tone : "amber";
              const noteTone = noteToneStyles[firstNoteTone];
              const blockTitle = scheduleText.blockTitle(a.title, a.titleCustom);
              const isPt = bcp47.toLowerCase().startsWith("pt");
              const crossdayHint = a.continuesToNextDay
                ? (isPt ? `Termina amanhã ${formatClock(displayEnd, bcp47)}` : `Ends tomorrow ${formatClock(displayEnd, bcp47)}`)
                : a.continuesFromPrevDay
                  ? (isPt ? `Começou ontem ${formatClock(displayStart, bcp47)}` : `Started yesterday ${formatClock(displayStart, bcp47)}`)
                  : null;
              const crossdayMeta = isDragging ? null : crossdayHint;
              const dragMeta = isDragging ? dragLimitHint : null;
              const crossdayIconTitle = crossdayMeta ?? crossdayHint;

              // Derived layout flags per tier
              const isMicro   = tier === "micro";
              const isCompact = tier === "compact";
              const isHour    = tier === "hour";
              const isFull    = tier === "full";

              // Notes display
              const showNotesRight  = isHour && hasNotes;   // pills to the right of title
              const previewLineCount = bh >= 62 ? 2 : bh >= 38 ? 1 : 0;
              const showNotesBelow  = isFull && hasNotes && previewLineCount > 0;
              const showStickyBadge = hasNotes && !showNotesRight && !showNotesBelow;

              // Layout constants per tier
              const gripW    = "w-7";
              const dotLeft  = "left-7";
              const cPl      = isMicro ? "pl-2" : "pl-4";
              const cPy      = isMicro ? "py-0" : "py-1.5";
              const titleSz  = isMicro ? "text-[10px] leading-none" : isCompact ? "text-xs" : isHour ? "text-sm" : "text-sm";
              const editW    = isMicro ? "w-7" : isCompact ? "w-7" : "w-9";
              const editVis  = isMicro ? "opacity-0 group-hover:opacity-100" : "";
              const editIcon = isMicro ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
              const railShape = isMicro
                ? "top-0.5 bottom-0.5 w-[2px] rounded-none"
                : "top-1.5 bottom-1.5 w-[2px] rounded-full";

              return (
                <div
                  key={a.id}
                  id={`day-block-${a.source}-${a.id}`}
                  className={`group absolute left-0 right-0 border ${flatTop ? "rounded-t-none" : "rounded-t-lg"} ${flatBottom ? "rounded-b-none" : "rounded-b-lg"} ${s.blockBg} ${
                    isDragging
                      ? `${s.blockBorder} shadow-lg opacity-90 cursor-grabbing`
                      : live
                        ? `${s.blockBorder} ring-2 ring-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.34)]`
                        : `${s.blockBorder} hover:border-secondary/50`
                  }`}
                  style={{
                    transform: `translate3d(0,${effectiveTop}px,0)`,
                    height: bh,
                    display: bh <= 0 && !isDragging ? "none" : undefined,
                    zIndex: isDragging ? 35 : live ? 15 : 10,
                    overflow: "visible",
                    willChange: isDragging ? "transform, height" : undefined,
                    transition: isDragging ? (dragLimitHint ? "none" : "transform 0.08s ease-out, height 0.08s ease-out") : "box-shadow 0.15s",
                    ...catBlockStyle,
                  }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[data-no-open="true"]')) return;
                    if (a.kind === "sleep") {
                      setEditSleep(true);
                      return;
                    }
                    if (hasDraggedRef.current) return;
                    if (draggingId) return;
                    setInspectItem(a);
                  }}
                  >
                    <div className={`absolute ${railShape} ${dotLeft} ${s.dot}`} style={catBlockStyle ? { backgroundColor: catColor } : undefined} />
                    {a.source === "commitment" && (
                      <div className={`absolute ${isMicro ? "top-0.5 bottom-0.5 w-[2px] rounded-none" : "top-1 bottom-1 w-[2px] rounded-full"} left-8 bg-amber-500/50 opacity-0 group-hover:opacity-100 transition-opacity`} />
                    )}
                    <div className="flex items-center h-full overflow-hidden">
                      <div
                      className={`${gripW} h-full shrink-0 flex items-center justify-center touch-none ${
                        "text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing"
                      }`}
                      data-no-open="true"
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => onGripDown(e, a)}
                    >
                      {isMicro ? (
                        <div className="h-3 w-3 grid place-items-center">
                          <div className="flex items-center gap-[1px]">
                            <span className="h-[2px] w-[2px] rounded-full bg-current" />
                            <span className="h-[2px] w-[2px] rounded-full bg-current" />
                          </div>
                        </div>
                      ) : (
                        <GripVertical className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {isDragging && dragTransitionHint && (
                      <div className={`absolute left-2 right-2 z-[40] pointer-events-none ${dragTransitionHint.edge === "bottom" ? "bottom-0 translate-y-1/2" : "top-0 -translate-y-1/2"}`}>
                        <div className="mx-auto flex max-w-[170px] flex-col items-center gap-1">
                          <div className={`flex h-2 w-full items-center justify-center rounded-full ${dragTransitionHint.pending ? "bg-primary/50" : "bg-primary/70"} shadow-[0_0_10px_hsl(var(--primary)/0.55)]`}>
                            {dragTransitionHint.direction === "down"
                              ? <ArrowDownToLine className="h-3 w-3 text-primary-foreground" />
                              : <ArrowUpToLine className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </div>
                      </div>
                    )}

                    {isDragging && dragMeta && (
                      <div className={`absolute z-[45] pointer-events-none max-w-[calc(100%-4rem)] truncate rounded border border-primary/30 bg-card/95 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-primary shadow-sm ${dragTransitionHint ? "left-1/2 -translate-x-1/2 top-0 -translate-y-full -mt-1" : "left-9 bottom-1"}`} title={dragMeta}>
                        {dragMeta}
                      </div>
                    )}

                    <div className={`flex-1 min-w-0 h-full ${cPy} ${cPl} pr-0.5 text-left overflow-hidden`}>

                      {/* ── MICRO TIER (≤15 min) ──────────────────────────────── */}
                      {isMicro && (
                        <div className="h-full flex items-center gap-1.5 leading-none min-w-0">
                          <span className={`inline-block h-3 w-3 rounded-[2px] shrink-0 ${s.chip}`} aria-hidden="true" />
                          <span className="num text-[9px] text-primary/90 shrink-0" title={`${formatClock(displayStart, bcp47)}–${formatClock(displayEnd, bcp47)}`}>
                            {formatClock(displayStart, bcp47)}–{formatClock(displayEnd, bcp47)}
                          </span>
                          {crossdayIconTitle && (
                            <span className={`shrink-0 rounded p-0.5 ${s.chip}`} title={crossdayIconTitle}>
                              {a.continuesFromPrevDay ? <ArrowUpToLine className="h-2 w-2" /> : <ArrowDownToLine className="h-2 w-2" />}
                            </span>
                          )}
                          <span className={`font-medium text-primary truncate ${titleSz}`} title={blockTitle}>{blockTitle}</span>
                          {crossdayMeta && (
                            <span className={`ml-auto max-w-[7.5rem] truncate text-[8px] uppercase tracking-wider rounded px-1 py-[1px] ${s.chip}`} title={crossdayMeta}>
                              {crossdayMeta}
                            </span>
                          )}
                          {hasNotes && (
                            <span className={`shrink-0 rounded p-0.5 ${noteTone.chip}`} title={noteLines.map((n) => n.text).join("\n")}>
                              <StickyNote className="h-2 w-2" />
                            </span>
                          )}
                          <BlockBadges a={a} tier="micro" />
                        </div>
                      )}

                      {/* ── COMPACT TIER (30–45 min) ──────────────────────────── */}
                        {isCompact && (
                        <div className="h-full flex flex-col justify-center gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip} font-medium shrink-0`} style={catChipStyle}>
                              {catChipLabel}
                            </span>
                            <span className={`min-w-0 flex-1 font-medium text-primary truncate ${titleSz}`}>{blockTitle}</span>
                            <span className="num text-[9px] text-muted-foreground/60 shrink-0 ml-auto">
                              {formatClock(displayStart, bcp47)}–{formatClock(displayEnd, bcp47)}
                              {displaySpansNextDay && <span className="ml-1 uppercase tracking-wider text-secondary/80">+1d</span>}
                              <span className="mx-1 opacity-50">·</span>
                              {fmtDur(displayDur)}
                            </span>
                            {crossdayMeta && (
                              <span className={`max-w-[11rem] truncate text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 ${s.chip}`} title={crossdayMeta}>
                                {crossdayMeta}
                              </span>
                            )}
                            {showStickyBadge && (
                              <span className={`shrink-0 rounded p-0.5 ${noteTone.chip}`} title={noteLines.map((n) => n.text).join("\n")}>
                                <StickyNote className="h-2.5 w-2.5" />
                              </span>
                            )}
                            <BlockBadges a={a} tier="compact" />
                          </div>
                        </div>
                      )}

                      {/* ── HOUR TIER (60 min) ─────────────────────────────────── */}
                      {isHour && (
                        <div className="h-full flex flex-col justify-center gap-0.5">
                          <div className="num text-[10px] text-muted-foreground/70 truncate">
                            {formatClock(displayStart, bcp47)}–{formatClock(displayEnd, bcp47)}
                            {displaySpansNextDay && <span className="ml-1 uppercase tracking-wider text-secondary/80">+1d</span>}
                            <span className="mx-1 opacity-50">·</span>
                            {fmtDur(displayDur)}
                            {crossdayMeta && <span className={`ml-2 text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 ${s.chip}`}>{crossdayMeta}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip} font-medium shrink-0`} style={catChipStyle}>
                              {catChipLabel}
                            </span>
                            <span className={`shrink min-w-0 font-medium text-primary truncate ${titleSz} max-w-[8rem]`}>{blockTitle}</span>
                            {/* Notes inline to the right */}
                            {showNotesRight && (
                              <span className="ml-0.5 flex min-w-0 flex-1 items-center gap-1 overflow-hidden" title={noteLines.map((n) => n.text).join("\n")}>
                                {noteLines.slice(0, 3).map((line, idx) => {
                                  const tone = noteToneStyles[line.tone];
                                  return (
                                    <span key={`${line.text}-${idx}`} className={`min-w-0 rounded px-1.5 py-0.5 text-[9px] ${tone.bg} ${tone.text} shrink-0`}>
                                      <span className="inline-flex items-center gap-1">
                                        <span className={`h-1.5 w-1.5 rounded-[2px] ${tone.solid} shrink-0`} />
                                        <span className="truncate max-w-[5rem]">{line.text}</span>
                                      </span>
                                    </span>
                                  );
                                })}
                              </span>
                            )}
                            {!showNotesRight && showStickyBadge && (
                              <span className={`shrink-0 rounded p-0.5 ${noteTone.chip}`} title={noteLines.map((n) => n.text).join("\n")}>
                                <StickyNote className="h-2.5 w-2.5" />
                              </span>
                            )}
                            <BlockBadges a={a} tier="hour" />
                          </div>
                        </div>
                      )}

                      {/* ── FULL TIER (≥75 min) ────────────────────────────────── */}
                      {isFull && (
                        <div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] num text-muted-foreground">
                            <span>{formatClock(displayStart, bcp47)}–{formatClock(displayEnd, bcp47)}</span>
                            {displaySpansNextDay && <span className="text-[10px] uppercase tracking-wider text-secondary/80">+1d</span>}
                            <span>·</span>
                            <span>{fmtDur(displayDur)}</span>
                            {crossdayMeta && <span className={`text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 ${s.chip}`}>{crossdayMeta}</span>}
                            {live && <span className="text-secondary font-medium uppercase tracking-wider">· {t.chronos.today.now}</span>}
                            {a.source === "commitment" && <span className="text-[10px] uppercase tracking-wider text-amber-500/80">· {t.chronos.today.commitmentTag}</span>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip} font-medium shrink-0`} style={catChipStyle}>
                              {catChipLabel}
                            </span>
                            <span className={`min-w-0 flex-1 font-medium text-primary truncate ${titleSz}`}>{blockTitle}</span>
                            {showStickyBadge && (
                              <span className={`shrink-0 rounded p-0.5 ${noteTone.chip}`} title={noteLines.map((n) => n.text).join("\n")}>
                                <StickyNote className="h-2.5 w-2.5" />
                              </span>
                            )}
                            <BlockBadges a={a} tier="full" />
                          </div>
                          {showNotesBelow && (
                            noteLines.length === 1 ? (
                              <div className={`mt-1 max-w-full rounded px-1.5 py-1 text-[10px] ${noteTone.bg} ${noteTone.text}`}>
                                <div className="inline-flex items-center gap-1">
                                  <StickyNote className="h-2.5 w-2.5 shrink-0" />
                                  <span className="line-clamp-1 leading-tight">{renderLinkedText(noteLines[0].text)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 max-w-full rounded px-1.5 py-1 text-[10px] bg-muted/25">
                                <div className="space-y-0.5 leading-tight">
                                  {noteLines.slice(0, previewLineCount).map((line, idx) => {
                                    const tone = noteToneStyles[line.tone];
                                    return (
                                      <div key={`${line.text}-${idx}`} className={`flex items-center gap-1 rounded px-1 py-0.5 ${tone.bg} ${tone.text}`}>
                                        <span className={`h-1.5 w-1.5 rounded-[2px] ${tone.solid} shrink-0`} />
                                        <span className="line-clamp-1">{renderLinkedText(line.text)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {!(a.kind === "sleep" && isBoundarySleepBlock(a)) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditItem(a); }}
                        data-no-open="true"
                        className={`shrink-0 ${editW} h-full flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-r-lg transition-all ${editVis}`}
                        aria-label="Edit"
                      >
                        <Pencil className={editIcon} />
                      </button>
                    )}
                    {!assignGoalId && isBlockTrackedForAnyGoal(a.source + "-" + (a.sourceId ?? a.id)) && (
                      <div className="shrink-0 w-7 h-full flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-secondary" />
                      </div>
                    )}
                    {assignGoalId && (() => {
                      const ag = data.goals.find((g) => g.id === assignGoalId);
                      if (!ag || ag.categoryId !== a.kind) return null;
                      const blockKey = a.source + "-" + (a.sourceId ?? a.id);
                      const isAssigned = ag.trackedBlockKeys?.includes(blockKey);
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); trackBlockForGoal(assignGoalId, blockKey); }}
                          data-no-open="true"
                          className={`shrink-0 w-7 h-full flex items-center justify-center transition-colors ${isAssigned ? "text-secondary" : "text-muted-foreground/40 hover:text-secondary"}`}
                          aria-label={isAssigned ? "Unassign" : "Assign"}
                        >
                          {isAssigned ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Plus className="h-3.5 w-3.5" />
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}

            {rawAgenda.filter((a) => !isBoundarySleepBlock(a)).length === 0 && (
              <div className="absolute inset-x-0 top-24 mx-auto max-w-xs rounded-lg border border-dashed border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">{t.chronos.today.noBlocks}</p>
                <div className="mt-3"><ComposeBlockDialog defaultDay={selectedDate.getDay()} defaultDateIso={selectedDateIso} /></div>
              </div>
            )}
          </div>
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

function BlockDetailsDialog({
  item,
  onEdit,
  onClose,
}: {
  item: AgendaItem;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const { data, trackBlockForGoal, updateCommitment, updateRoutine } = useSchedule();
  const noteLines = parseNotes(item.notes);
  const kindVisual = safeKindStyle(item.kind, data.categories);
  const dialogCat = data.categories.find((c) => c.id === item.kind);
  const blockKey = item.source + "-" + (item.sourceId ?? item.id);
  const dialogGoals = data.goals.filter(
    (g) => g.categoryId === item.kind && g.autoTrackMode
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[min(80vh,calc(100dvh-3rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">
            {scheduleText.blockTitle(item.title, item.titleCustom)}
          </DialogTitle>
          <DialogDescription>
            {bcp47.toLowerCase().startsWith("pt") ? "Detalhes rapidos do bloco selecionado." : "Quick details for the selected block."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1 min-w-0">
          <div className="text-xs text-muted-foreground num">
            {formatClock(item.start, bcp47)}–{formatClock(item.end, bcp47)} · {fmtDur(durationMin(item.start, item.end))}
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.kind}</span>
            <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${kindVisual.chip} ${kindVisual.blockBorder}`} style={kindVisual.chipStyle}>
              {scheduleText.categoryLabel(item.kind, dialogCat?.label, dialogCat?.labelCustom)}
            </span>
            {item.source === "commitment" && (
              <span className="rounded border border-amber-500/30 bg-amber-500/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80">
                {bcp47.toLowerCase().startsWith("pt") ? "Compromisso" : "Commitment"}
              </span>
            )}
          </div>
          {(() => {
            const cat = data.categories.find((c) => c.id === item.kind);
            const structure = cat?.workspace;
            if (!structure) return null;
            return (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  {cat?.label ?? item.kind}
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/10 p-3 overflow-x-auto min-w-0">
                  <SessionView
                    structure={structure}
                    runtime={
                      item.source === "commitment"
                        ? (data.commitments.find((c) => c.id === item.id)?.workspace ?? {})
                        : (data.routine.find((r) => r.id === (item.sourceId ?? item.id))?.workspace ?? {})
                    }
                    onChange={(newExt) => {
                      if (item.source === "commitment") {
                        updateCommitment(item.id, { workspace: newExt });
                      } else {
                        updateRoutine(item.id, { workspace: newExt });
                      }
                    }}
                    onClose={() => onClose()}
                  />
                </div>
              </div>
            );
          })()}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t.chronos.dialog.notes}</div>
            {noteLines.length === 0 ? (
              <div className="text-sm text-muted-foreground">-</div>
            ) : (
              <div className="space-y-1.5 text-sm leading-snug">
                {noteLines.map((line, index) => {
                  const tone = noteToneStyles[line.tone];
                  return (
                    <div key={`${line.text}-${index}`} className={`rounded border px-2 py-1 ${tone.border} ${tone.bg} ${tone.text}`}>
                      {renderLinkedText(line.text)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {dialogGoals.length > 0 && (
            <div className="border-t border-border/30 pt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tracked to goals</div>
              {dialogGoals.map((g) => {
                const mode = g.autoTrackMode ?? "always";
                const isTracked = g.trackedBlockKeys?.includes(blockKey);
                if (mode === "always") {
                  return (
                    <div key={g.id} className="flex items-center gap-2 w-full text-xs py-1.5 px-2 rounded opacity-60">
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-primary font-medium">{g.title}</div>
                        <div className="text-[10px] text-muted-foreground">Always (auto-tracked)</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <button key={g.id}
                    onClick={() => trackBlockForGoal(g.id, blockKey)}
                    className="flex items-center gap-2 w-full text-left text-xs py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    {isTracked ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-primary font-medium">{g.title}</div>
                      <div className="text-[10px] text-muted-foreground">{mode === "selected" ? "Selected" : "Commitments"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          
          <DialogFooter>
            <Button type="button" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              {bcp47.toLowerCase().startsWith("pt") ? "Editar" : "Edit"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BlockEditDialog({
  item,
  categories,
  onSave,
  onRemove,
  onClose,
}: {
  item: AgendaItem;
  categories: { id: string; label: string; labelCustom?: string }[];
  onSave: (patch: Partial<AgendaItem> & { titleCustom?: string; endsNextDay?: boolean }) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const { data } = useSchedule();
  const [title, setTitle] = useState(scheduleText.blockTitle(item.title, item.titleCustom));
  const [kind, setKind] = useState<BlockKind>(item.kind);
  const [start, setStart] = useState(item.start);
  const [end, setEnd] = useState(item.end);
  const [endsNextDay, setEndsNextDay] = useState(Boolean(item.continuesToNextDay) || end <= start);
  const [noteLines, setNoteLines] = useState<NoteLine[]>(() => parseNotes(item.notes));
  const [editWorkspace, setEditWorkspace] = useState<Record<string, unknown>>(() => item.workspace ?? {});
  const dur = durationMin(start, end);

  useEffect(() => {
    if (end <= start) setEndsNextDay(true);
  }, [start, end]);

  const toneOptions: { value: NoteTone; label: string }[] = [
    { value: "amber", label: "Amber" },
    { value: "sky", label: "Sky" },
    { value: "emerald", label: "Emerald" },
    { value: "rose", label: "Rose" },
    { value: "violet", label: "Violet" },
  ];

  function addNoteLine() {
    setNoteLines((prev) => [...prev, { text: "", tone: "amber" }]);
  }

  function updateNoteText(index: number, text: string) {
    setNoteLines((prev) => prev.map((note, i) => (i === index ? { ...note, text } : note)));
  }

  function updateNoteTone(index: number, tone: NoteTone) {
    setNoteLines((prev) => prev.map((note, i) => (i === index ? { ...note, tone } : note)));
  }

  function removeNoteLine(index: number) {
    setNoteLines((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    const next = title.trim();
    if (!next) return;
    const defaultTitle = scheduleText.blockTitle(item.title);
    const extData = Object.keys(editWorkspace).length > 0 ? editWorkspace : undefined;
    const patch: Partial<AgendaItem> & { titleCustom?: string; endsNextDay?: boolean } = {
      start,
      end,
      kind,
      endsNextDay: endsNextDay || end <= start,
      notes: serializeNotes(noteLines),
      title: item.title,
      titleCustom: isKnownDefaultBlockTitle(item.title)
        ? (next !== defaultTitle ? next : undefined)
        : undefined,
      workspace: extData,
    };
    if (!isKnownDefaultBlockTitle(item.title)) {
      onSave({ ...patch, title: next });
    } else {
      onSave(patch);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[min(80vh,calc(100dvh-3rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">{scheduleText.blockTitle(item.title, item.titleCustom)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1 min-w-0">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.title_field}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.kind}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.filter((c) => c.id !== "sleep").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{scheduleText.categoryLabel(c.id as BlockKind, c.label, c.labelCustom)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.start}</Label>
              <TimeSelect value={start} onValueChange={setStart} bcp47={bcp47} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.end}</Label>
              <TimeSelect value={end} onValueChange={setEnd} bcp47={bcp47} className="h-9" />
            </div>
          </div>
          <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-ends-next-day"
                checked={endsNextDay}
                onCheckedChange={(checked) => setEndsNextDay(checked === true)}
              />
              <Label htmlFor="edit-ends-next-day" className="text-[11px] text-muted-foreground">
                {bcp47.toLowerCase().startsWith("pt") ? "Termina no dia seguinte" : "Ends next day"}
              </Label>
            </div>
          </div>
          {dur > 0 && <p className="text-[11px] num text-secondary">{t.chronos.today.duration}: {fmtDur(dur)}</p>}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.notes}</Label>
            {noteLines.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3">
                <button
                  type="button"
                  onClick={addNoteLine}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-secondary/40 px-2 py-1 text-[11px] text-secondary/80 hover:text-secondary hover:border-secondary"
                >
                  <Plus className="h-3 w-3" />
                  {bcp47.toLowerCase().startsWith("pt") ? "Adicionar nota" : "Add note"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {noteLines.map((line, index) => {
                  const tone = noteToneStyles[line.tone];
                  return (
                    <div key={`edit-note-${index}`} className={`relative rounded-md border p-2 pl-3 ${tone.border} ${tone.bg}`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${tone.solid}`} />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Input
                          value={line.text}
                          onChange={(e) => updateNoteText(index, e.target.value)}
                          placeholder={t.chronos.dialog.notesPlaceholder}
                          className="h-8 min-w-[100px] flex-1"
                        />
                        <Select value={line.tone} onValueChange={(v) => updateNoteTone(index, v as NoteTone)}>
                          <SelectTrigger className="h-8 w-16 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {toneOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeNoteLine(index)} className="h-8 w-7 px-0 text-muted-foreground shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addNoteLine}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-secondary/40 px-2 py-1 text-[11px] text-secondary/80 hover:text-secondary hover:border-secondary"
                >
                  <Plus className="h-3 w-3" />
                  {bcp47.toLowerCase().startsWith("pt") ? "Adicionar outra nota" : "Add another note"}
                </button>
              </div>
            )}
            {(() => {
              const cat = data.categories.find((c) => c.id === item.kind);
              const structure = cat?.workspace;
              if (!structure) return null;
              return (
                <div className="space-y-2 border-t border-border/30 pt-3">
                  <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {cat?.label ?? item.kind}
                  </Label>
                  <div className="overflow-x-auto min-w-0">
                    <SessionView
                    structure={structure}
                    runtime={editWorkspace}
                    onChange={(newExt) => setEditWorkspace(newExt)}
                    onClose={() => {}}
                  />
                </div>
                </div>
              );
            })()}
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />{t.chronos.today.removeBlock}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
            <Button size="sm" onClick={save}>{t.common.save}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SleepEditDialog({
  sleepWindow,
  dayLabel,
  dateIso: _dateIso,
  sleepCuts,
  onSaveWindow,
  onAddOrUpdateSleepCut,
  onRemoveSleepCut,
  onClose,
}: {
  sleepWindow: { start: string; end: string; days?: number[] };
  dayLabel: string;
  dateIso: string;
  sleepCuts: SleepCut[];
  onSaveWindow: (patch: { start: string; end: string; applyToAllDays: boolean }) => void;
  onAddOrUpdateSleepCut: (cut: { start: string; end: string; previous?: { date: string; start?: string; end?: string } }) => void;
  onRemoveSleepCut: (target: { date: string; start?: string; end?: string }) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const isPt = bcp47.toLowerCase().startsWith("pt");

  const [start, setStart] = useState(
    sleepWindow.start === "00:00" || sleepWindow.start === "24:00" ? "24:00" : sleepWindow.start,
  );
  const [end, setEnd] = useState(sleepWindow.end === "24:00" ? "07:00" : sleepWindow.end);
  const [hasSleepStart, setHasSleepStart] = useState(
    sleepWindow.start !== "00:00" && sleepWindow.start !== sleepWindow.end,
  );
  const [hasWakeTime, setHasWakeTime] = useState(
    sleepWindow.end !== "00:00" && sleepWindow.start !== sleepWindow.end,
  );
  const [breakStart, setBreakStart] = useState("02:00");
  const [breakEnd, setBreakEnd] = useState("08:00");
  const [editingBreak, setEditingBreak] = useState<{ date: string; start: string; end: string } | null>(null);
  const [applyToAllDays, setApplyToAllDays] = useState(false);

  const breakDurMin = timeToMinutes(breakEnd) - timeToMinutes(breakStart);
  const timelineColors = {
    wake: "bg-zinc-900/85 dark:bg-zinc-100/85",
    bedtime: "bg-zinc-600/85 dark:bg-zinc-300/85",
    break: "bg-zinc-400/80 dark:bg-zinc-500/80",
  } as const;

  const sleepTimeOptions = useMemo(
    () => [
      ...Array.from({ length: 24 * 4 }, (_, i) => {
        const minutes = i * 15;
        const h = String(Math.floor(minutes / 60)).padStart(2, "0");
        const m = String(minutes % 60).padStart(2, "0");
        return `${h}:${m}`;
      }),
      "24:00",
    ],
    [],
  );

  const effectiveHasSleepStart = hasSleepStart;
  const computedStart = effectiveHasSleepStart ? start : "00:00";
  const computedEnd = hasWakeTime ? end : "00:00";
  const noNightBoundary = computedStart === computedEnd;
  const spansMidnight = timeToMinutes(computedEnd) <= timeToMinutes(computedStart);
  const wakeOnlyMode = hasWakeTime && !effectiveHasSleepStart;
  const bedtimeOnlyMode = effectiveHasSleepStart && !hasWakeTime;

  const bedtimeOptions = useMemo(() => {
    const noMidnightStart = sleepTimeOptions.filter((time) => time !== "00:00");
    if (!hasWakeTime) return noMidnightStart;
    const wakeMin = timeToMinutes(end);
    return noMidnightStart.filter((time) => time === "24:00" || timeToMinutes(time) > wakeMin);
  }, [hasWakeTime, end, sleepTimeOptions]);
  const wakeOptions = useMemo(() => {
    if (!effectiveHasSleepStart) return sleepTimeOptions.filter((time) => time !== "24:00");
    const bedtimeCutoff = timeToMinutes(start);
    return sleepTimeOptions.filter((time) => time !== "24:00" && timeToMinutes(time) < bedtimeCutoff);
  }, [effectiveHasSleepStart, start, sleepTimeOptions]);

  const toPct = (min: number) => `${(Math.max(0, Math.min(24 * 60, min)) / (24 * 60)) * 100}%`;
  const wakeMin = hasWakeTime ? timeToMinutes(end) : null;
  const bedtimeMin = effectiveHasSleepStart ? timeToMinutes(start) : null;
  const bedtimeVisualMin = hasSleepStart ? (start === "24:00" ? 24 * 60 : timeToMinutes(start)) : null;
  const sleepSegments = (() => {
    if (!hasSleepStart && !hasWakeTime) return [] as Array<{ start: number; end: number }>;
    if (wakeOnlyMode && wakeMin !== null) return [{ start: 0, end: wakeMin }];
    if (bedtimeOnlyMode && bedtimeMin !== null) return [{ start: bedtimeMin, end: 24 * 60 }];
    if (bedtimeMin === null || wakeMin === null) return [] as Array<{ start: number; end: number }>;
    if (wakeMin <= bedtimeMin) return [{ start: 0, end: wakeMin }, { start: bedtimeMin, end: 24 * 60 }];
    return [{ start: bedtimeMin, end: wakeMin }];
  })();
  const totalSleepMin = (() => {
    const gross = sleepSegments.reduce((sum, segment) => sum + Math.max(0, segment.end - segment.start), 0);
    if (gross === 0 || sleepCuts.length === 0) return gross;
    let overlapMin = 0;
    for (const segment of sleepSegments) {
      for (const cut of sleepCuts) {
        const cutStart = timeToMinutes(cut.start);
        const cutEnd = timeToMinutes(cut.end);
        const overlap = Math.max(0, Math.min(segment.end, cutEnd) - Math.max(segment.start, cutStart));
        overlapMin += overlap;
      }
    }
    return Math.max(0, gross - overlapMin);
  })();
  const breakStartOptions = useMemo(() => {
    const dayOptions = sleepTimeOptions.filter((time) => time !== "24:00");
    const ranges = sleepSegments.length > 0 ? sleepSegments : [{ start: 0, end: 24 * 60 }];
    return dayOptions.filter((time) => {
      const min = timeToMinutes(time);
      return ranges.some((segment) => min >= segment.start && min + SNAP <= segment.end);
    });
  }, [sleepTimeOptions, sleepSegments]);
  const breakEndOptions = useMemo(() => {
    const dayOptions = sleepTimeOptions.filter((time) => time !== "24:00");
    const startMin = timeToMinutes(breakStart);
    const ranges = sleepSegments.length > 0 ? sleepSegments : [{ start: 0, end: 24 * 60 }];
    const activeRange = ranges.find((segment) => startMin >= segment.start && startMin < segment.end);
    if (!activeRange) return dayOptions.filter((time) => timeToMinutes(time) > startMin);
    return dayOptions.filter((time) => {
      const endMin = timeToMinutes(time);
      return endMin > startMin && endMin <= activeRange.end;
    });
  }, [sleepTimeOptions, sleepSegments, breakStart]);
  const canSaveBreak =
    breakDurMin > 0 &&
    breakStartOptions.includes(breakStart) &&
    breakEndOptions.includes(breakEnd);

  function save() {
    if ((hasSleepStart && !start) || (hasWakeTime && !end)) return;
    if (hasWakeTime && !wakeOptions.includes(end)) return;
    if (hasWakeTime && effectiveHasSleepStart && timeToMinutes(start) <= timeToMinutes(end)) return;
    if (!hasSleepStart && !hasWakeTime) {
      onSaveWindow({ start: "00:00", end: "00:00", applyToAllDays });
      onClose();
      return;
    }
    onSaveWindow({ start: computedStart, end: computedEnd, applyToAllDays });
    onClose();
  }

  useEffect(() => {
    if (!hasSleepStart) return;
    if (bedtimeOptions.includes(start)) return;
    setStart(bedtimeOptions[0] ?? "24:00");
  }, [hasSleepStart, bedtimeOptions, start]);

  useEffect(() => {
    if (!hasWakeTime) return;
    if (wakeOptions.includes(end)) return;
    setEnd(wakeOptions[wakeOptions.length - 1] ?? "00:00");
  }, [hasWakeTime, wakeOptions, end]);

  useEffect(() => {
    if (breakStartOptions.includes(breakStart)) return;
    setBreakStart(breakStartOptions[0] ?? "00:00");
  }, [breakStartOptions, breakStart]);

  useEffect(() => {
    if (breakEndOptions.includes(breakEnd)) return;
    setBreakEnd(breakEndOptions[0] ?? breakStart);
  }, [breakEndOptions, breakEnd, breakStart]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">
            {isPt ? "Sono" : "Sleep"}
          </DialogTitle>
          <DialogDescription>
            {isPt
              ? `Configurando ${dayLabel}. Para consistência semanal, aplique este padrão para todos os dias.`
              : `Configuring ${dayLabel}. For weekly consistency, apply this pattern to all days.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="apply-sleep-all-days"
                checked={applyToAllDays}
                onCheckedChange={(checked) => setApplyToAllDays(checked === true)}
              />
              <Label htmlFor="apply-sleep-all-days" className="text-[11px] text-muted-foreground">
                {isPt ? "Aplicar este padrão de sono a todos os dias" : "Apply this sleep pattern to all days"}
              </Label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 min-h-[2.5rem]">
                <Checkbox id="sleep-end-enabled" checked={hasWakeTime} onCheckedChange={(checked) => setHasWakeTime(checked === true)} />
                <Label htmlFor="sleep-end-enabled" className="text-[11px] text-muted-foreground">
                  {isPt ? "Definir horário de acordar" : "Set wake time"}
                </Label>
              </div>
              <div className={hasWakeTime ? "" : "pointer-events-none opacity-50"}>
                <TimeSelect value={end} onValueChange={setEnd} bcp47={bcp47} max={effectiveHasSleepStart ? start : undefined} placeholder={isPt ? "Horario" : "Time"} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 min-h-[2.5rem]">
                <Checkbox id="sleep-start-enabled" checked={hasSleepStart} onCheckedChange={(checked) => setHasSleepStart(checked === true)} />
                <Label htmlFor="sleep-start-enabled" className="text-[11px] text-muted-foreground">
                  {isPt ? "Definir horário para dormir" : "Set bedtime"}
                </Label>
              </div>
              <div className={hasSleepStart ? "" : "pointer-events-none opacity-50"}>
                <TimeSelect value={start} onValueChange={setStart} bcp47={bcp47} min={hasWakeTime ? end : undefined} allowMidnight exclude={["00:00"]} placeholder={isPt ? "Horario" : "Time"} />
              </div>
            </div>
          </div>
          <div className="space-y-2 rounded-md border border-border/50 bg-gradient-to-b from-card/70 to-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isPt ? "Mapa visual de sono" : "Sleep visual map"}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${timelineColors.wake}`} />{isPt ? "Acordar" : "Wake"}</span>
              <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${timelineColors.bedtime}`} />{isPt ? "Dormir" : "Bedtime"}</span>
              <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${timelineColors.break}`} />{isPt ? "Pausa" : "Break"}</span>
            </div>
            <div className="relative h-8 rounded-lg border border-border/40 bg-card/80 px-2">
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2">
                <div className="relative h-[6px]">
                  <div className="absolute inset-0 rounded-full bg-border/60" />
                  {sleepSegments.map((segment, index) => (
                    <div
                      key={`sleep-segment-${index}`}
                      className="absolute top-0 h-[6px] rounded-full bg-zinc-700/35 dark:bg-zinc-300/35"
                      style={{ left: toPct(segment.start), width: toPct(segment.end - segment.start) }}
                    />
                  ))}
                  {sleepCuts.map((cut, index) => {
                    const cutStart = timeToMinutes(cut.start);
                    const cutEnd = timeToMinutes(cut.end);
                    return (
                      <div
                        key={`cut-${index}-${cut.start}-${cut.end}`}
                        className={`absolute top-0 h-[6px] rounded-full ${timelineColors.break}`}
                        style={{ left: toPct(cutStart), width: toPct(cutEnd - cutStart) }}
                      />
                    );
                  })}
                  {wakeMin !== null && (
                    <div
                      className={`absolute top-1/2 h-6 w-0.5 -translate-y-1/2 rounded ${timelineColors.wake}`}
                      style={{ left: toPct(Math.min(24 * 60 - 1, wakeMin)) }}
                    />
                  )}
                  {bedtimeVisualMin !== null && (
                    <div
                      className={`absolute top-1/2 h-6 w-0.5 -translate-y-1/2 rounded ${timelineColors.bedtime}`}
                      style={{ left: toPct(Math.min(24 * 60 - 1, bedtimeVisualMin)) }}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isPt ? `Sono total: ${fmtPreviewMinutes(totalSleepMin, true)}` : `Total sleep: ${fmtPreviewMinutes(totalSleepMin, false)}`}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              {!hasSleepStart && !hasWakeTime
                ? (isPt ? "Sem janela de sono ativa para este dia." : "No active sleep window for this day.")
                : wakeOnlyMode
                ? (isPt ? "Modo acordar apenas: a timeline útil começa no horário de acordar." : "Wake-only mode: effective timeline starts at wake time.")
                : bedtimeOnlyMode
                ? (isPt ? "Modo dormir apenas: o dia encerra na faixa final noturna." : "Bedtime-only mode: day closes with a night-end cap.")
                : noNightBoundary
                ? (isPt ? "Início e fim iguais; ajuste para formar uma janela válida." : "Start and end are equal; adjust to create a valid window.")
                : spansMidnight
                ? (isPt ? "Janela noturna atravessa a meia-noite." : "Night window spans across midnight.")
                : (isPt ? "Janela de sono no mesmo dia." : "Sleep window stays within the same day.")}
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-dashed border-border/60 bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {bcp47.toLowerCase().startsWith("pt") ? "Pausas de sono neste dia" : "Sleep breaks for this day"}
            </div>
            {sleepCuts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{bcp47.toLowerCase().startsWith("pt") ? "Nenhuma pausa cadastrada." : "No sleep breaks yet."}</p>
            ) : (
              <div className="space-y-1.5">
                {sleepCuts.map((cut) => (
                  <div key={`${cut.date}-${cut.start}-${cut.end}`} className="flex items-center justify-between rounded border border-border/50 bg-muted/35 px-2 py-1">
                    <span className="text-[11px] num text-muted-foreground">{formatClock(cut.start, bcp47)}–{formatClock(cut.end, bcp47)}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 border-border/40 bg-muted/40 px-2 text-[10px] hover:bg-muted/60"
                        onClick={() => {
                          setEditingBreak({ date: cut.date, start: cut.start, end: cut.end });
                          setBreakStart(cut.start);
                          setBreakEnd(cut.end);
                        }}
                      >
                        {bcp47.toLowerCase().startsWith("pt") ? "Editar" : "Edit"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 border-border/40 bg-muted/40 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          onRemoveSleepCut({ date: cut.date, start: cut.start, end: cut.end });
                          if (editingBreak && editingBreak.date === cut.date && editingBreak.start === cut.start && editingBreak.end === cut.end) {
                            setEditingBreak(null);
                          }
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        {bcp47.toLowerCase().startsWith("pt") ? "Remover" : "Remove"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.start}</Label>
                <TimeSelect value={breakStart} onValueChange={setBreakStart} bcp47={bcp47} times={breakStartOptions} placeholder={isPt ? "Horario" : "Time"} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.end}</Label>
                <TimeSelect value={breakEnd} onValueChange={setBreakEnd} bcp47={bcp47} times={breakEndOptions} placeholder={isPt ? "Horario" : "Time"} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className={`text-[11px] ${canSaveBreak ? "text-muted-foreground" : "text-rose-500"}`}>
                {canSaveBreak
                  ? `${bcp47.toLowerCase().startsWith("pt") ? "Duracao" : "Duration"}: ${fmtPreviewMinutes(breakDurMin, bcp47.toLowerCase().startsWith("pt"))}`
                  : (bcp47.toLowerCase().startsWith("pt") ? "O fim deve ser apos o inicio." : "End must be after start.")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  onAddOrUpdateSleepCut({
                    start: breakStart,
                    end: breakEnd,
                    previous: editingBreak ? { date: editingBreak.date, start: editingBreak.start, end: editingBreak.end } : undefined,
                  });
                  setEditingBreak(null);
                }}
                disabled={!canSaveBreak}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {editingBreak
                  ? (bcp47.toLowerCase().startsWith("pt") ? "Atualizar pausa" : "Update break")
                  : (bcp47.toLowerCase().startsWith("pt") ? "Salvar pausa" : "Save break")}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
          <Button size="sm" onClick={save}>{t.common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
