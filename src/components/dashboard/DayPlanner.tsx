import { useEffect, useMemo, useRef, useState } from "react";
import { useSchedule, buildAgendaForDate, getSleepWindowForDay } from "@/lib/schedule/store";
import { BlockKind, durationMin, timeToMinutes } from "@/lib/schedule/types";
import type { SleepCut, SleepScheduleEntry } from "@/lib/schedule/types";
import { kindStyle } from "./widgets";
import { useFmtDur, useI18n, useT } from "@/lib/i18n/I18nProvider";
import { isKnownDefaultBlockTitle, useScheduleText } from "@/lib/i18n/scheduleText";
import { ArrowDownToLine, ArrowUpToLine, ChevronLeft, ChevronRight, Clock, GripVertical, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComposeBlockDialog } from "./ComposeBlockDialog";
import { TimeSelect } from "@/components/ui/time-select";

const HOUR_PX = 64;
const SNAP = 15;
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
};

type FreeSlot = { type: "free"; id: string; start: string; end: string };

function snapTime(min: number) {
  const s = Math.round(min / SNAP) * SNAP;
  if (s >= 24 * 60) return "24:00";
  const c = Math.max(0, Math.min(23 * 60 + 59, s));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
}

function clockTimeFromMin(min: number) {
  const day = 24 * 60;
  const wrapped = ((Math.round(min / SNAP) * SNAP) % day + day) % day;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

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

export function DayPlanner() {
  const { data, addRoutine, pushMoveDayChain, updateRoutine, updateSleepWindow, updateSleepSchedule, setSleepBoundaryEnforced, addSleepCut, removeSleepCut, removeRoutine, updateCommitment, removeCommitment } = useSchedule();
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
  // Read from sleepSchedule (new) falling back to sleepWindow (legacy).
  const enforceSleepBoundary = data.meta.enforceSleepBoundary !== false;
  const sleepSchedule = data.meta.sleepSchedule ?? [data.meta.sleepWindow ?? { start: "22:30", end: "07:00" }];
  const sleepEntry = getSleepWindowForDay(sleepSchedule, selectedDate.getDay()) ?? sleepSchedule[0];

  const sleepStartMin = timeToMinutes(sleepEntry.start);
  const sleepEndMin   = timeToMinutes(sleepEntry.end);
  // Cross-day sleep: sleep starts in the evening and ends the next morning (start > end)
  const hasCrossDaySleep = enforceSleepBoundary && sleepStartMin > sleepEndMin;
  // Same-day sleep: sleep starts and ends within the same calendar day (start < end)
  const hasSameDaySleep  = enforceSleepBoundary && sleepStartMin < sleepEndMin;

  // Visual boundary markers
  const morningSleep = hasCrossDaySleep ? { start: "00:00", end: sleepEntry.end } : null;
  const eveningSleep = hasCrossDaySleep ? { start: sleepEntry.start, end: "24:00" } : null;
  const sameDaySleep = hasSameDaySleep  ? { start: sleepEntry.start, end: sleepEntry.end } : null;

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
  // When overnight sleep is not enforced, keep the day frame stable at 00:00–24:00
  // so dragging crossday blocks does not keep redefining the visible bottom edge.
  if (!enforceSleepBoundary) {
    startMin = 0;
    endMin = 24 * 60;
  }

  // For same-day sleep, show the full sleep zone
  if (hasSameDaySleep) {
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

  // For today: ensure "now" is always in view
  if (isToday && enforceSleepBoundary) {
    startMin = Math.min(startMin, Math.max(0, nowMin - 60));
    endMin   = Math.max(endMin,   Math.min(24 * 60, nowMin + 60));
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

  const projectMinute = (minute: number) => {
    if (sleepSplits.length === 0) return minute;
    let hiddenBefore = 0;
    for (const cut of sleepSplits) {
      if (minute >= cut.endMin) {
        hiddenBefore += cut.durMin - cut.laneMin;
        continue;
      }
      if (minute > cut.startMin) {
        // Keep a thin visible lane for each cut and map current time proportionally inside it.
        const ratio = (minute - cut.startMin) / cut.durMin;
        return cut.startMin - hiddenBefore + ratio * cut.laneMin;
      }
      return minute - hiddenBefore;
    }
    return minute - hiddenBefore;
  };

  const topForProjected = (time: string) => ((projectMinute(timeToMinutes(time)) - projectMinute(startMin)) / 60) * HOUR_PX;

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
  }, [JSON.stringify(nonSleepAgenda), startMin, endMin, selectedDateIso, sleepSplits]);

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
  const topBadgeLane = morningSleep ? 26 : 0;
  const scrollRef = useRef<HTMLDivElement>(null);

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
  } | null>(null);
  const [dragDeltaMin, setDragDeltaMin] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragDeltaRef = useRef(0);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [dragLimitHint, setDragLimitHint] = useState<string | null>(null);
  const [dragTransitionHint, setDragTransitionHint] = useState<{ edge: "top" | "bottom"; direction: "up" | "down"; pending: boolean } | null>(null);
  const hasDraggedRef = useRef(false); // true once mouse moves during a drag session

  const [editItem, setEditItem] = useState<AgendaItem | null>(null);
  const [editSleep, setEditSleep] = useState(false);
  const [selectedSleepCut, setSelectedSleepCut] = useState<SleepCut | null>(null);
  const [editSleepCut, setEditSleepCut] = useState(false);
  const [inspectItem, setInspectItem] = useState<AgendaItem | null>(null);

  useEffect(() => {
    if (!isToday || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: Math.max(0, ((projectMinute(nowMin) - projectMinute(startMin)) / 60) * HOUR_PX + topBadgeLane - 200), behavior: "smooth" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function updateDragPreview(rawDeltaMin: number) {
    if (!dragState.current) return;
    const isPt = bcp47.toLowerCase().startsWith("pt");
    const { origStartMin, origDurMin, transitionEdge, minStartMin, maxStartMin } = dragState.current;

    // ── BOTTOM EDGE (normal block being pushed toward next day) ──────────
    if (transitionEdge === "bottom") {
      const rawEnd = origStartMin + origDurMin + rawDeltaMin;
      const spillMin = rawEnd - 24 * 60; // positive = spill into next day

      if (spillMin >= COMMIT_MIN) {
        // Past commit threshold — clamp so at least MIN_IN_DAY stays today
        const maxSpill = origDurMin - MIN_IN_DAY;
        const clampedSpill = Math.min(spillMin, maxSpill);
        const previewDelta = 24 * 60 - origStartMin - origDurMin + clampedSpill;
        setDragDeltaMin(previewDelta);
        dragDeltaRef.current = previewDelta;
        setDragTransitionHint({ edge: "bottom", direction: "down", pending: false });
        const nextDayMin = Math.round(clampedSpill);
        setDragLimitHint(isPt ? `${nextDayMin}m no próximo dia` : `${nextDayMin}m into next day`);
        return;
      }
      if (spillMin >= TEASE_MIN) {
        // Tease zone: clamp preview, show pending arrow
        const previewDelta = 24 * 60 - origStartMin - origDurMin; // fills the day exactly
        const clamped = Math.max(previewDelta, minStartMin - origStartMin);
        setDragDeltaMin(clamped);
        dragDeltaRef.current = clamped;
        setDragTransitionHint({ edge: "bottom", direction: "down", pending: true });
        setDragLimitHint(null);
        return;
      }
      // Normal drag within the day
      const rawStart = origStartMin + rawDeltaMin;
      const clampedStart = Math.max(minStartMin, Math.min(rawStart, maxStartMin));
      const previewDelta = clampedStart - origStartMin;
      setDragDeltaMin(previewDelta);
      dragDeltaRef.current = previewDelta;
      setDragTransitionHint(null);
      if (clampedStart <= minStartMin && rawStart < minStartMin) {
        setDragLimitHint(isPt ? "Limite superior" : "Top limit");
      } else if (clampedStart >= maxStartMin && rawStart > maxStartMin) {
        setDragLimitHint(isPt ? "Limite inferior" : "Bottom limit");
      } else {
        setDragLimitHint(null);
      }
      return;
    }

    // ── TOP EDGE (continuesFromPrevDay block being pulled toward prev day) ──
    if (transitionEdge === "top") {
      const spillIntoPrevDay = -rawDeltaMin; // positive = pulling upward

      if (spillIntoPrevDay >= COMMIT_MIN) {
        const maxSpill = origDurMin - MIN_IN_DAY;
        const clampedSpill = Math.min(spillIntoPrevDay, maxSpill);
        const previewDelta = -clampedSpill;
        setDragDeltaMin(previewDelta);
        dragDeltaRef.current = previewDelta;
        setDragTransitionHint({ edge: "top", direction: "up", pending: false });
        const prevDayMin = Math.round(clampedSpill);
        setDragLimitHint(isPt ? `${prevDayMin}m no dia anterior` : `${prevDayMin}m into prev day`);
        return;
      }
      if (spillIntoPrevDay >= TEASE_MIN) {
        setDragDeltaMin(0);
        dragDeltaRef.current = 0;
        setDragTransitionHint({ edge: "top", direction: "up", pending: true });
        setDragLimitHint(null);
        return;
      }
      // Normal drag downward (pushing start later in the day)
      const rawStart = origStartMin + rawDeltaMin;
      const clampedStart = Math.max(0, Math.min(rawStart, maxStartMin));
      const previewDelta = clampedStart - origStartMin;
      setDragDeltaMin(previewDelta);
      dragDeltaRef.current = previewDelta;
      setDragTransitionHint(null);
      setDragLimitHint(null);
    }
  }

  function commitDrag(snappedDelta: number) {
    if (!dragState.current) return;
    const { sourceId, source, origStartMin, origDurMin, transitionEdge } = dragState.current;

    if (transitionEdge === "bottom") {
      const rawEnd = origStartMin + origDurMin + snappedDelta;
      const spillMin = rawEnd - 24 * 60;

      if (spillMin >= COMMIT_MIN) {
        const newStart = clockTimeFromMin(origStartMin + snappedDelta);
        const err = pushMoveDayChain(selectedDate, source, sourceId, newStart, "24:00", snappedDelta, "bottom");
        if (err) toast({ title: "Conflict", description: err });
        return;
      }
      // Normal move within the day
      const newStart = clockTimeFromMin(origStartMin + snappedDelta);
      const newEnd   = clockTimeFromMin(origStartMin + origDurMin + snappedDelta);
      const err = pushMoveDayChain(selectedDate, source, sourceId, newStart, newEnd, snappedDelta, "bottom");
      if (err) toast({ title: "Conflict", description: err });
      return;
    }

    if (transitionEdge === "top") {
      const spillIntoPrevDay = -snappedDelta;

      if (spillIntoPrevDay >= COMMIT_MIN) {
        const maxSpill = origDurMin - MIN_IN_DAY;
        const clampedSpill = Math.min(spillIntoPrevDay, maxSpill);
        const newStart = clockTimeFromMin(clampedSpill);
        const newEnd   = clockTimeFromMin(origDurMin);
        const err = pushMoveDayChain(selectedDate, source, sourceId, newStart, newEnd, -clampedSpill, "top");
        if (err) toast({ title: "Conflict", description: err });
        return;
      }
      // Normal move within the day
      const rawStart    = origStartMin + snappedDelta;
      const clampedStart = Math.max(0, rawStart);
      const newStart = clockTimeFromMin(clampedStart);
      const newEnd   = clockTimeFromMin(clampedStart + origDurMin);
      const err = pushMoveDayChain(selectedDate, source, sourceId, newStart, newEnd, snappedDelta, "top");
      if (err) toast({ title: "Conflict", description: err });
    }
  }

  function onGripDown(e: React.MouseEvent, a: AgendaItem) {
    e.preventDefault();
    if (a.kind === "sleep") return;
    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }
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
    const wakeMin = sleepStartMin > sleepEndMin ? sleepEndMin : 0;
    const bedMin  = sleepStartMin > sleepEndMin ? sleepStartMin : 24 * 60;
    const sourceDurMin = durationMin(sourceStart, sourceEnd);
    const transitionEdge: "top" | "bottom" = a.continuesFromPrevDay ? "top" : "bottom";

    // origStartMin: for top-edge blocks the segment starts at 00:00 on this day
    const origStartMin = transitionEdge === "top" ? 0 : timeToMinutes(sourceStart);
    const minStartMin  = wakeMin;
    const maxStartMin  = bedMin - sourceDurMin;

    dragState.current = {
      id: a.id,
      sourceId,
      source: a.source,
      originY: e.clientY,
      origStartMin,
      origDurMin: sourceDurMin,
      sourceSpansNextDay: transitionEdge === "top" || (sourceStart > sourceEnd && sourceStart !== "00:00"),
      transitionEdge,
      minStartMin,
      maxStartMin,
    };
    setDraggingId(a.id);
    setDragDeltaMin(0);
    dragDeltaRef.current = 0;
    hasDraggedRef.current = false;
    setDragLimitHint(null);

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      hasDraggedRef.current = true;
      const rawDeltaPx = ev.clientY - dragState.current.originY;
      const rawDeltaMin = (rawDeltaPx / HOUR_PX) * 60;
      const snapped = Math.round(rawDeltaMin / SNAP) * SNAP;
      updateDragPreview(snapped);
    };
    const handleMouseDone = (_ev: MouseEvent) => {
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

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseDone, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseDone);
    };
  }

  function handleSave(patch: Partial<AgendaItem> & { titleCustom?: string; endsNextDay?: boolean }) {
    if (!editItem) return;
    const targetId = editItem.sourceId ?? editItem.id;
    const err = editItem.source === "routine"
      ? updateRoutine(targetId, patch)
      : updateCommitment(targetId, patch as any);
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

  // Keep the bottom controls visible even when overnight sleep is optional.
  const needsBottomSleepLane = Boolean(eveningSleep) || !enforceSleepBoundary;
  const bottomBadgeLane = needsBottomSleepLane ? 28 : 0;
  const timelineContentHeight = totalHeight + topBadgeLane;
  const timelineHeight = timelineContentHeight + bottomBadgeLane;

  const positionedTimeline = useMemo(() => {
    return timeline.map((item, index) => {
      const top = topForProjected(item.start) + topBadgeLane;
      const desiredHeight = "type" in item
        ? (item.type === "free"
          ? freeHeight(item.start, item.end)
          : Math.max(12, ((timeToMinutes(item.end) - timeToMinutes(item.start)) / 60) * HOUR_PX - 2))
        : blockHeight(item.start, item.end);
      const nextTop = index < timeline.length - 1
        ? topForProjected(timeline[index + 1].start) + topBadgeLane
        : timelineContentHeight;
      const maxHeightWithoutOverlap = Math.max(6, nextTop - top - STACK_GAP_PX);
      return { item, top, height: Math.min(desiredHeight, maxHeightWithoutOverlap) };
    });
  }, [timeline, topBadgeLane, timelineContentHeight]);

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

      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto">
        <div className="relative" style={{ height: timelineHeight, userSelect: draggingId ? "none" : undefined }}>
          {hours.map((h) => {
            const hideLabel = isToday && projectMinute(h * 60) === projectedNowMin;
            const isFirstHourLine = h === hours[0];
            return (
              <div key={h} className="absolute left-0 right-0 border-t border-border/30 pointer-events-none" style={{ top: ((projectMinute(h * 60) - projectMinute(startMin)) / 60) * HOUR_PX + topBadgeLane }}>
                {!hideLabel && (
                  <span className={`absolute left-3 text-[10px] num text-muted-foreground/50 bg-card px-1 ${isFirstHourLine ? "top-1" : "-top-2"}`}>{formatHourLabel(h, bcp47)}</span>
                )}
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

          {morningSleep && (
            <div className="absolute left-[68px] right-4 z-[20]" style={{ top: 2, height: topBadgeLane }}>
              <button
                onClick={() => setEditSleep(true)}
                className="absolute right-0 bottom-[4px] text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
              >
                {bcp47.toLowerCase().startsWith("pt") ? `Sono até ${formatClock(morningSleep.end, bcp47)}` : `Sleep until ${formatClock(morningSleep.end, bcp47)}`}
              </button>
            </div>
          )}
          {(eveningSleep || !enforceSleepBoundary) && (
            <div
              className="absolute left-[68px] right-4 z-[20]"
              style={{ top: eveningSleep ? topForProjected(eveningSleep.start) + topBadgeLane + 4 : timelineContentHeight + 4 }}
            >
              <div className="flex items-center justify-end gap-1.5">
                <button
                  onClick={() => { setSelectedSleepCut(null); setEditSleepCut(true); }}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-dashed border-primary/35 text-primary/70 hover:bg-primary/10 hover:border-primary/50 hover:text-primary/90 transition-colors"
                  title={bcp47.toLowerCase().startsWith("pt") ? "Adicionar pausa de sono neste dia" : "Add a sleep break for this day"}
                >
                  <Plus className="h-3 w-3" />
                  {bcp47.toLowerCase().startsWith("pt") ? "Pausa de sono" : "Sleep break"}
                </button>
                <button
                  onClick={() => setEditSleep(true)}
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
                >
                  {eveningSleep
                    ? (bcp47.toLowerCase().startsWith("pt") ? `Horário de sono: ${formatClock(eveningSleep.start, bcp47)}` : `Sleep hours: ${formatClock(eveningSleep.start, bcp47)}`)
                    : (bcp47.toLowerCase().startsWith("pt") ? "Hoje sem horário de sono" : "No sleep hours today")}
                </button>
              </div>
            </div>
          )}
          {/* ── SLEEP CUT DIVIDER (mid-day, per-date) ────────────────────────
               A full-width bar that splits the timeline into two segments.
               Clicking opens the SleepCutDialog for this specific day. */}
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
                onClick={() => { setSelectedSleepCut(sleepSplit.cut); setEditSleepCut(true); }}
                className="group absolute left-[68px] right-4 z-[25] rounded-md border border-dashed border-primary/35 bg-muted/45 text-primary/85 hover:bg-muted/65 hover:border-primary/50 transition-colors"
                style={{ top: splitTopOffset, height: splitHeight }}
                aria-label={isPt ? "Editar pausa de sono" : "Edit sleep break"}
              >
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider num pointer-events-none">
                  <span className="font-medium">{isPt ? "Pausa" : "Break"}</span>
                  <span className="opacity-75">{formatClock(sleepSplit.cut.start, bcp47)}–{formatClock(sleepSplit.cut.end, bcp47)}</span>
                </div>
                <div
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary/70 hover:text-rose-500 border border-primary/20 hover:border-rose-400/50 rounded px-1.5 py-0.5 bg-card opacity-0 group-hover:opacity-100 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSleepCut({ date: sleepSplit.cut.date, start: sleepSplit.cut.start, end: sleepSplit.cut.end });
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    e.stopPropagation();
                    removeSleepCut({ date: sleepSplit.cut.date, start: sleepSplit.cut.start, end: sleepSplit.cut.end });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{isPt ? "Remover" : "Remove"}</span>
                </div>
              </button>
            );
          })}



          <div className="absolute left-[68px] right-4 top-0 bottom-0 z-10">
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
              const s = kindStyle[a.kind];
              const live = a.id === liveId;

              if (isDragging && dragState.current && dragState.current.sourceId === (a.sourceId ?? a.id)) {
                const draggedSourceStart = dragState.current.origStartMin + dragDeltaMin;
                const draggedSourceEnd = draggedSourceStart + dragState.current.origDurMin;

                if (a.continuesFromPrevDay) {
                  const visibleEnd = Math.min(24 * 60, draggedSourceEnd - 24 * 60);
                  if (visibleEnd <= 0) {
                    bh = 0;
                  } else {
                    effectiveTop = topForProjected("00:00") + topBadgeLane;
                    bh = Math.max(12, (visibleEnd / 60) * HOUR_PX - 2);
                  }
                } else {
                  const visibleStart = Math.max(0, draggedSourceStart);
                  const visibleEnd = Math.min(24 * 60, draggedSourceEnd);
                  if (visibleEnd <= visibleStart) {
                    bh = 0;
                  } else {
                    effectiveTop = topForProjected(snapTime(visibleStart)) + topBadgeLane;
                    bh = Math.max(12, ((visibleEnd - visibleStart) / 60) * HOUR_PX - 2);
                  }
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
              const crossdayMeta = isDragging ? dragLimitHint : crossdayHint;
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
                    top: effectiveTop,
                    height: bh,
                    display: bh <= 0 ? "none" : undefined,
                    zIndex: isDragging ? 35 : live ? 15 : 10,
                    overflow: "visible",
                    transition: isDragging ? "none" : "box-shadow 0.15s",
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
                  <div className={`absolute ${railShape} ${dotLeft} ${s.dot}`} />
                  <div className="flex items-center h-full overflow-hidden">
                    <div
                      className={`${gripW} h-full shrink-0 flex items-center justify-center touch-none ${
                        "text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing"
                      }`}
                      data-no-open="true"
                      onMouseDown={(e) => onGripDown(e, a)}
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
                        <div className={`mx-auto flex h-2 max-w-[140px] items-center justify-center rounded-full ${dragTransitionHint.pending ? "bg-primary/50" : "bg-primary/70"} shadow-[0_0_10px_hsl(var(--primary)/0.55)]`}>
                          {dragTransitionHint.direction === "down"
                            ? <ArrowDownToLine className="h-3 w-3 text-primary-foreground" />
                            : <ArrowUpToLine className="h-3 w-3 text-primary-foreground" />}
                        </div>
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
                        </div>
                      )}

                      {/* ── COMPACT TIER (30–45 min) ──────────────────────────── */}
                      {isCompact && (
                        <div className="h-full flex flex-col justify-center gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip} font-medium shrink-0`}>
                              {t.common.kinds[a.kind]}
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
                            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip} font-medium shrink-0`}>
                              {t.common.kinds[a.kind]}
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
                            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip} font-medium shrink-0`}>
                              {t.common.kinds[a.kind]}
                            </span>
                            <span className={`min-w-0 flex-1 font-medium text-primary truncate ${titleSz}`}>{blockTitle}</span>
                            {showStickyBadge && (
                              <span className={`shrink-0 rounded p-0.5 ${noteTone.chip}`} title={noteLines.map((n) => n.text).join("\n")}>
                                <StickyNote className="h-2.5 w-2.5" />
                              </span>
                            )}
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
          sleepWindow={sleepEntry}
          enforceBoundary={enforceSleepBoundary}
          onSaveWindow={(patch) => {
            const dow = selectedDate.getDay();
            const prevSchedule: SleepScheduleEntry[] = data.meta.sleepSchedule ?? [{ start: sleepEntry.start, end: sleepEntry.end }];
            const hasSpecificEntry = prevSchedule.some((e) => e.days?.includes(dow));
            let nextSchedule: SleepScheduleEntry[];
            if (hasSpecificEntry) {
              nextSchedule = prevSchedule.map((e): SleepScheduleEntry =>
                e.days?.includes(dow) ? { ...e, start: patch.start ?? e.start, end: patch.end ?? e.end } : e
              );
            } else {
              const allDay = prevSchedule.find((e) => !e.days);
              if (allDay) {
                nextSchedule = prevSchedule.map((e): SleepScheduleEntry =>
                  !e.days ? { ...e, start: patch.start ?? e.start, end: patch.end ?? e.end } : e
                );
              } else {
                nextSchedule = [...prevSchedule, { start: patch.start ?? sleepEntry.start, end: patch.end ?? sleepEntry.end, days: [dow] }];
              }
            }
            updateSleepSchedule(nextSchedule);
            setEditSleep(false);
          }}
          onSetEnforceBoundary={(enforced) => {
            setSleepBoundaryEnforced(enforced);
          }}
          onAddInstance={(start, end) => {
            const sleepCategory = data.categories.find((c) => c.id === "sleep");
            const sleepTitle = scheduleText.categoryLabel(
              "sleep",
              sleepCategory?.label ?? t.common.kinds.sleep,
              sleepCategory?.labelCustom,
            );
            const err = addRoutine({
              day: selectedDate.getDay(),
              start,
              end,
              endsNextDay: false,
              kind: "sleep",
              title: sleepTitle,
            });
            if (err) {
              toast({ title: "Conflict", description: err });
              return;
            }
            setEditSleep(false);
          }}
          onClose={() => setEditSleep(false)}
        />
      )}
      {editSleepCut && (
        <SleepCutDialog
          dateIso={selectedDateIso}
          existing={selectedSleepCut}
          bcp47={bcp47}
          onSave={(cut) => {
            if (selectedSleepCut) {
              removeSleepCut({
                date: selectedSleepCut.date,
                start: selectedSleepCut.start,
                end: selectedSleepCut.end,
              });
            }
            addSleepCut(cut);
            setEditSleepCut(false);
            setSelectedSleepCut(null);
          }}
          onRemove={() => {
            if (selectedSleepCut) {
              removeSleepCut({
                date: selectedSleepCut.date,
                start: selectedSleepCut.start,
                end: selectedSleepCut.end,
              });
            }
            setEditSleepCut(false);
            setSelectedSleepCut(null);
          }}
          onClose={() => { setEditSleepCut(false); setSelectedSleepCut(null); }}
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
    </div>
  );
}

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
  const noteLines = parseNotes(item.notes);
  const kindVisual = kindStyle[item.kind];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">
            {scheduleText.blockTitle(item.title, item.titleCustom)}
          </DialogTitle>
          <DialogDescription>
            {bcp47.toLowerCase().startsWith("pt") ? "Detalhes rapidos do bloco selecionado." : "Quick details for the selected block."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="text-xs text-muted-foreground num">
            {formatClock(item.start, bcp47)}–{formatClock(item.end, bcp47)} · {fmtDur(durationMin(item.start, item.end))}
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.kind}</span>
            <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${kindVisual.chip} ${kindVisual.blockBorder}`}>
              {t.common.kinds[item.kind]}
            </span>
          </div>
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
  const [title, setTitle] = useState(scheduleText.blockTitle(item.title, item.titleCustom));
  const [kind, setKind] = useState<BlockKind>(item.kind);
  const [start, setStart] = useState(item.start);
  const [end, setEnd] = useState(item.end);
  const [endsNextDay, setEndsNextDay] = useState(Boolean(item.continuesToNextDay) || end <= start);
  const [noteLines, setNoteLines] = useState<NoteLine[]>(() => parseNotes(item.notes));
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
    };
    if (!isKnownDefaultBlockTitle(item.title)) {
      onSave({ ...patch, title: next });
    } else {
      onSave(patch);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">{scheduleText.blockTitle(item.title, item.titleCustom)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
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
                      <div className="flex items-center gap-2">
                        <Input
                          value={line.text}
                          onChange={(e) => updateNoteText(index, e.target.value)}
                          placeholder={t.chronos.dialog.notesPlaceholder}
                          className="h-8"
                        />
                        <Select value={line.tone} onValueChange={(v) => updateNoteTone(index, v as NoteTone)}>
                          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {toneOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeNoteLine(index)} className="h-8 w-8 px-0 text-muted-foreground">
                          <Trash2 className="h-3.5 w-3.5" />
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
  enforceBoundary,
  onSaveWindow,
  onSetEnforceBoundary,
  onAddInstance,
  onClose,
}: {
  sleepWindow: { start: string; end: string; days?: number[] };
  enforceBoundary: boolean;
  onSaveWindow: (patch: Partial<{ start: string; end: string; days?: number[] }>) => void;
  onSetEnforceBoundary: (enforced: boolean) => void;
  onAddInstance: (start: string, end: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const [start, setStart] = useState(sleepWindow.start);
  const [end, setEnd] = useState(sleepWindow.end);
  const noNightBoundary = start === end;
  const spansMidnight = end <= start;

  function save() {
    if (!start || !end) return;
    if (spansMidnight) {
      onSaveWindow({ start, end });
      return;
    }
    onAddInstance(start, end);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">
            {bcp47.toLowerCase().startsWith("pt") ? "Sono" : "Sleep"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="enforce-sleep-boundary"
                checked={enforceBoundary}
                onCheckedChange={(checked) => onSetEnforceBoundary(checked === true)}
              />
              <Label htmlFor="enforce-sleep-boundary" className="text-[11px] text-muted-foreground">
                {bcp47.toLowerCase().startsWith("pt") ? "Manter horário de sono" : "Keep sleep hours"}
              </Label>
            </div>
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
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              {noNightBoundary
                ? (bcp47.toLowerCase().startsWith("pt") ? "Início igual ao fim: deixa a madrugada livre e permite blocos até 00:00+." : "Start equals end: leaves the late night open and allows blocks up to/after midnight.")
                : spansMidnight
                ? (bcp47.toLowerCase().startsWith("pt") ? "Cruza para o dia seguinte: atualiza a pausa noturna deste dia." : "Crosses into next day: updates this day's overnight pause.")
                : (bcp47.toLowerCase().startsWith("pt") ? "Mesmo dia: cria uma instancia separada de sono neste dia." : "Same day: creates a separate sleep instance for this day.")}
            </p>
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
function SleepCutDialog({
  dateIso,
  existing,
  bcp47,
  onSave,
  onRemove,
  onClose,
}: {
  dateIso: string;
  existing: SleepCut | null;
  bcp47: string;
  onSave: (cut: { date: string; start: string; end: string }) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const fmtDur = useFmtDur();
  const [start, setStart] = useState(existing?.start ?? "02:00");
  const [end, setEnd]     = useState(existing?.end   ?? "08:00");
  const isPt = bcp47.toLowerCase().startsWith("pt");
  const durMin = timeToMinutes(end) - timeToMinutes(start);
  const valid  = durMin > 0;

  function save() {
    if (!valid) return;
    onSave({ date: dateIso, start, end });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">
            {isPt ? "Pausa de sono" : "Sleep break"}
          </DialogTitle>
          <DialogDescription>
            {isPt
              ? "Define uma pausa de sono para compactar a timeline deste dia."
              : "Define a sleep break that compacts this day's timeline."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
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
          {valid
            ? <p className="text-[11px] text-muted-foreground num">{isPt ? "Duração" : "Duration"}: {fmtDur(durMin)}</p>
            : <p className="text-[11px] text-rose-500">{isPt ? "O fim deve ser após o início." : "End must be after start."}</p>}
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          {existing ? (
            <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />{isPt ? "Remover" : "Remove"}
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
            <Button size="sm" onClick={save} disabled={!valid}>{t.common.save}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}