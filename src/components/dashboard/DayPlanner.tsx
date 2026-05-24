import { useEffect, useMemo, useRef, useState } from "react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { BlockKind, durationMin, timeToMinutes } from "@/lib/schedule/types";
import { kindStyle } from "./widgets";
import { useFmtDur, useI18n, useT } from "@/lib/i18n/I18nProvider";
import { isKnownDefaultBlockTitle, useScheduleText } from "@/lib/i18n/scheduleText";
import { ChevronLeft, ChevronRight, Clock, GripVertical, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComposeBlockDialog } from "./ComposeBlockDialog";
import { TimeSelect } from "@/components/ui/time-select";

const HOUR_PX = 64;
const SNAP = 15;

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
  const {
    data,
    addRoutine,
    pushMoveDayChain,
    updateRoutine,
    updateSleepWindow,
    removeRoutine,
    updateCommitment,
    removeCommitment,
  } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const { bcp47 } = useI18n();
  const scheduleText = useScheduleText();
  const nowMin = useNowMin();

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const isToday = isSameDay(selectedDate, new Date());

  const rawAgenda = buildAgendaForDate(data, selectedDate);
  const selectedDateIso = toIsoDate(selectedDate);
  const liveId = isToday
    ? rawAgenda.find((a) => timeToMinutes(a.start) <= nowMin && nowMin < timeToMinutes(a.end))?.id
    : undefined;

  const nonSleepAgenda = useMemo(
    () => rawAgenda.filter((a) => !isBoundarySleepBlock(a)).sort((a, b) => a.start.localeCompare(b.start)),
    [rawAgenda],
  );

  const sleepWindow = data.meta.sleepWindow;
  const sleepStartMin = timeToMinutes(sleepWindow.start);
  const sleepEndMin = timeToMinutes(sleepWindow.end);
  const hasCrossDaySleep = sleepStartMin > sleepEndMin;
  const hasSameDaySleep = sleepStartMin < sleepEndMin;

  const morningSleep = hasCrossDaySleep
    ? { start: "00:00", end: sleepWindow.end }
    : null;
  const eveningSleep = hasCrossDaySleep
    ? { start: sleepWindow.start, end: "24:00" }
    : null;
  const sameDaySleep = hasSameDaySleep
    ? { start: sleepWindow.start, end: sleepWindow.end }
    : null;

  const defaultStartMin = timeToMinutes(data.meta.workdayStart);
  const defaultEndMin = timeToMinutes(data.meta.workdayEnd);

  let startMin = hasCrossDaySleep ? sleepEndMin : defaultStartMin;
  let endMin = hasCrossDaySleep ? sleepStartMin : defaultEndMin;

  // For same-day sleep, ensure the timeline always encompasses the full sleep window.
  if (hasSameDaySleep) {
    startMin = Math.min(startMin, sleepStartMin);
    endMin = Math.max(endMin, sleepEndMin);
  }

  const firstWorkStart = nonSleepAgenda.length > 0 ? timeToMinutes(nonSleepAgenda[0].start) : defaultStartMin;
  const lastWorkEnd = nonSleepAgenda.length > 0 ? timeToMinutes(nonSleepAgenda[nonSleepAgenda.length - 1].end) : defaultEndMin;

  startMin = Math.min(startMin, firstWorkStart);
  endMin = Math.max(endMin, lastWorkEnd);

  if (endMin - startMin < 60) {
    startMin = defaultStartMin;
    endMin = defaultEndMin;
  }
  if (endMin - startMin < 60) {
    startMin = 0;
    endMin = 24 * 60;
  }

  if (isToday) {
    startMin = Math.min(startMin, Math.max(0, nowMin - 60));
    endMin = Math.max(endMin, Math.min(24 * 60, nowMin + 60));

    // Keep "jump to now" context without extending beyond explicit sleep bounds.
    if (hasCrossDaySleep) {
      startMin = Math.max(startMin, sleepEndMin);
      endMin = Math.min(endMin, sleepStartMin);
    }
  }

  const sameDaySleepGap = useMemo(() => {
    if (!sameDaySleep) return null;
    const gapStart = Math.max(startMin, timeToMinutes(sameDaySleep.start));
    const gapEnd = Math.min(endMin, timeToMinutes(sameDaySleep.end));
    if (gapEnd - gapStart < SNAP) return null;
    return { startMin: gapStart, endMin: gapEnd };
  }, [sameDaySleep, startMin, endMin]);

  const timeline = useMemo(() => {
    return buildTimeline(nonSleepAgenda, startMin, endMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(nonSleepAgenda), startMin, endMin, selectedDateIso]);

  const totalHeight = ((endMin - startMin) / 60) * HOUR_PX;
  const firstVisibleHour = Math.ceil(startMin / 60);
  const lastVisibleHour = Math.floor(endMin / 60);
  const hours = Array.from(
    { length: Math.max(0, lastVisibleHour - firstVisibleHour + 1) },
    (_, i) => firstVisibleHour + i,
  );
  const clampedNowMin = Math.max(startMin, Math.min(nowMin, endMin));
  const isNowClamped = isToday && clampedNowMin !== nowMin;
  const topBadgeLane = morningSleep ? 26 : 0;
  const scrollRef = useRef<HTMLDivElement>(null);

  const dragState = useRef<{
    id: string;
    sourceId: string;
    source: "routine" | "commitment";
    originY: number;
    origStartMin: number;
    origEndMin: number;
  } | null>(null);
  const [dragDeltaMin, setDragDeltaMin] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [editItem, setEditItem] = useState<AgendaItem | null>(null);
  const [editSleep, setEditSleep] = useState(false);
  const [inspectItem, setInspectItem] = useState<AgendaItem | null>(null);

  useEffect(() => {
    if (!isToday || !scrollRef.current) return;
    scrollRef.current.scrollTo({ top: Math.max(0, ((nowMin - startMin) / 60) * HOUR_PX + topBadgeLane - 200), behavior: "smooth" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function jumpToNow() {
    scrollRef.current?.scrollTo({
      top: Math.max(0, ((nowMin - startMin) / 60) * HOUR_PX + topBadgeLane - 200),
      behavior: "smooth",
    });
  }

  function onGripDown(e: React.PointerEvent, a: AgendaItem) {
    if (a.source === "routine" && a.derived) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = {
      id: a.id,
      sourceId: a.sourceId ?? a.id,
      source: a.source,
      originY: e.clientY,
      origStartMin: timeToMinutes(a.start),
      origEndMin: timeToMinutes(a.end),
    };
    setDraggingId(a.id);
    setDragDeltaMin(0);
  }

  function onGripMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const snapped = Math.round(((e.clientY - dragState.current.originY) / HOUR_PX) * 60 / SNAP) * SNAP;
    setDragDeltaMin(snapped);
  }

  function onGripUp(e: React.PointerEvent) {
    if (!dragState.current) return;
    const { sourceId, source, origStartMin, origEndMin } = dragState.current;
    const snapped = Math.round(((e.clientY - dragState.current.originY) / HOUR_PX) * 60 / SNAP) * SNAP;
    if (snapped !== 0) {
      const ns = snapTime(origStartMin + snapped);
      const ne = snapTime(origEndMin + snapped);
      const err = pushMoveDayChain(selectedDate, source, sourceId, ns, ne);
      if (err) toast({ title: "Conflict", description: err });
    }
    dragState.current = null;
    setDraggingId(null);
    setDragDeltaMin(0);
  }

  function onGripCancel() {
    dragState.current = null;
    setDraggingId(null);
    setDragDeltaMin(0);
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

  const timelineHeight = totalHeight + topBadgeLane;

  const positionedTimeline = useMemo(() => {
    return timeline.map((item, index) => {
      const top = topFor(item.start, startMin) + topBadgeLane;
      const desiredHeight = "type" in item
        ? (item.type === "free"
          ? freeHeight(item.start, item.end)
          : Math.max(12, ((timeToMinutes(item.end) - timeToMinutes(item.start)) / 60) * HOUR_PX - 2))
        : blockHeight(item.start, item.end);
      const nextTop = index < timeline.length - 1
        ? topFor(timeline[index + 1].start, startMin) + topBadgeLane
        : timelineHeight;
      const maxHeightWithoutOverlap = Math.max(6, nextTop - top - 2);
      return { item, top, height: Math.min(desiredHeight, maxHeightWithoutOverlap) };
    });
  }, [timeline, startMin, topBadgeLane, timelineHeight]);

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
            const hideLabel = isNowClamped && clampedNowMin === h * 60;
            return (
              <div key={h} className="absolute left-0 right-0 border-t border-border/30 pointer-events-none" style={{ top: ((h * 60 - startMin) / 60) * HOUR_PX + topBadgeLane }}>
                {!hideLabel && (
                  <span className="absolute -top-2 left-3 text-[10px] num text-muted-foreground/50 bg-card px-1">{formatHourLabel(h, bcp47)}</span>
                )}
              </div>
            );
          })}

          {isToday && (
            <>
              <div
                className="absolute left-[68px] right-4 z-[6] pointer-events-none"
                style={{ top: ((clampedNowMin - startMin) / 60) * HOUR_PX + topBadgeLane }}
              >
                {isNowClamped
                  ? <div className="h-[3px] w-16 rounded-full bg-gradient-to-r from-primary/85 via-primary/60 to-transparent" />
                  : (draggingId !== null || nonSleepAgenda.some((a) => timeToMinutes(a.start) <= nowMin && nowMin < timeToMinutes(a.end))
                    ? <div className="h-[3px] w-7 rounded-full bg-primary/80" />
                    : <div className="h-[3px] w-full rounded-full bg-primary/80" />)}
              </div>
              <div
                className="absolute left-2 z-[12] pointer-events-none"
                style={{ top: ((clampedNowMin - startMin) / 60) * HOUR_PX + topBadgeLane }}
              >
                <div className="relative -translate-y-1/2 flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-card" />
                  <span className="text-[10px] num font-medium text-primary bg-card border border-primary/30 px-1 rounded shadow-sm">
                    {`${String(Math.floor(nowMin / 60)).padStart(2, "0")}:${String(nowMin % 60).padStart(2, "0")}`}
                  </span>
                </div>
              </div>
            </>
          )}

          {morningSleep && (
            <div
              className="absolute left-[68px] right-4 z-[20]"
              style={{ top: 2, height: topBadgeLane }}
            >
              <button
                onClick={() => setEditSleep(true)}
                className="absolute right-0 bottom-[4px] block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
              >
                {bcp47.toLowerCase().startsWith("pt") ? `Sono até ${formatClock(morningSleep.end, bcp47)}` : `Sleep until ${formatClock(morningSleep.end, bcp47)}`}
              </button>
            </div>
          )}
          {eveningSleep && (
            <div
              className="absolute left-[68px] right-4 z-[20]"
              style={{ top: topFor(eveningSleep.start, startMin) + topBadgeLane }}
            >
              <button
                onClick={() => setEditSleep(true)}
                className="ml-auto block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
              >
                {bcp47.toLowerCase().startsWith("pt") ? `Sono às ${formatClock(eveningSleep.start, bcp47)}` : `Sleep at ${formatClock(eveningSleep.start, bcp47)}`}
              </button>
            </div>
          )}
          {sameDaySleep && (
            <>
              {/* Sleep at — at void start, same style as cross-day evening button */}
              <div
                className="absolute left-[68px] right-4 z-[20]"
                style={{ top: topFor(sameDaySleep.start, startMin) + topBadgeLane }}
              >
                <button
                  onClick={() => setEditSleep(true)}
                  className="ml-auto block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
                >
                  {bcp47.toLowerCase().startsWith("pt") ? `Sono às ${formatClock(sameDaySleep.start, bcp47)}` : `Sleep at ${formatClock(sameDaySleep.start, bcp47)}`}
                </button>
              </div>
              {/* Sleep until — at void end, same style as cross-day morning button */}
              <div
                className="absolute left-[68px] right-4 z-[20]"
                style={{ top: topFor(sameDaySleep.end, startMin) + topBadgeLane - 22, height: 26 }}
              >
                <button
                  onClick={() => setEditSleep(true)}
                  className="absolute right-0 bottom-[4px] block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
                >
                  {bcp47.toLowerCase().startsWith("pt") ? `Sono até ${formatClock(sameDaySleep.end, bcp47)}` : `Sleep until ${formatClock(sameDaySleep.end, bcp47)}`}
                </button>
              </div>
            </>
          )}

          {sameDaySleepGap && (
            <div
              className="absolute left-[68px] right-4 z-[8] pointer-events-none rounded-xl border border-primary/25 bg-primary/[0.06] shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.05)] overflow-hidden"
              style={{
                top: ((sameDaySleepGap.startMin - startMin) / 60) * HOUR_PX + topBadgeLane,
                height: Math.max(12, durationMin(snapTime(sameDaySleepGap.startMin), snapTime(sameDaySleepGap.endMin)) / 60 * HOUR_PX),
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-primary/10" />
              <div className="absolute inset-x-0 bottom-0 h-px bg-primary/10" />
              <div className="relative h-full px-3 py-2 flex flex-col justify-between">
                <span className="text-[10px] uppercase tracking-wider text-primary/60">
                  {bcp47.toLowerCase().startsWith("pt") ? "Sono" : "Sleep"}
                </span>
                <span className="text-[10px] num uppercase tracking-wider text-muted-foreground/50 self-end">
                  {fmtDur(durationMin(snapTime(sameDaySleepGap.startMin), snapTime(sameDaySleepGap.endMin)))}
                </span>
              </div>
            </div>
          )}

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
              const isDragging = draggingId === a.id;
              const preOffset = top - (topFor(a.start, startMin) + topBadgeLane);
              const effectiveTop = isDragging ? topFor(snapTime(sm + dragDeltaMin), startMin) + topBadgeLane + preOffset : top;
              const bh = height;
              const s = kindStyle[a.kind];
              const live = a.id === liveId;
              // Size tiers — drive all layout choices
              const microBlock   = bh < 20;  // strip: no grip icon, ultra-tight padding
              // Tiny mode is duration-based: only true 15-minute blocks.
              const tinyBlock    = blockMinutes <= 15;
              // 45-minute blocks should behave like normal blocks.
              const compactBlock = blockMinutes < 45;
              const thirtyBlock = blockMinutes === 30;
              const isFortyFiveBlock = blockMinutes === 45;
              const noteLines = parseNotes(a.notes);
              const hasNotes = noteLines.length > 0;
              const preferRightNoteLane = blockMinutes === 60;
              const showInlineOneHourNotes = hasNotes && !tinyBlock && preferRightNoteLane;
              // Progressive notes visibility: 2 lines -> 1 line -> icon only
              const previewLineCount = bh >= 62 ? 2 : bh >= 38 ? 1 : 0;
              const showStickyPreview = hasNotes && !tinyBlock && previewLineCount > 0 && !preferRightNoteLane;
              const showStickyBadge = hasNotes && !showInlineOneHourNotes;
              const showStickyMetaFallback = hasNotes && !tinyBlock && !showStickyPreview && blockMinutes > 60;
              const showTinySticky = hasNotes;
              const showCompactMeta = compactBlock && !tinyBlock && bh >= 28 && !thirtyBlock;
              const showRightMetaLane = showStickyMetaFallback || showCompactMeta;
              const showCategoryChip = !tinyBlock;
              const flatTop = Boolean(a.continuesFromPrevDay) || a.start === "00:00";
              const flatBottom = Boolean(a.continuesToNextDay) || a.end === "24:00";
              const firstNoteTone = hasNotes ? noteLines[0].tone : "amber";
              const noteTone = noteToneStyles[firstNoteTone];
              const blockTitle = scheduleText.blockTitle(a.title, a.titleCustom);

              // Graduated layout values keyed to block height tier
              const gripW    = "w-7";
              const dotLeft  = "left-7";
              const cPl      = microBlock ? "pl-3" : "pl-4";
              const cPy      = (microBlock || tinyBlock) ? "py-0.5" : "py-1.5";
              const titleSz  = microBlock ? "text-[9px] leading-none" : tinyBlock ? "text-[10px] leading-tight" : compactBlock ? "text-xs" : "text-sm";
              const editW    = tinyBlock ? "w-9" : compactBlock ? "w-6" : "w-9";
              // Keep edit visible on 30/45-minute compact blocks; only tiny keeps hover reveal.
              const editVis  = tinyBlock ? "opacity-0 group-hover:opacity-100" : "";
              const editIcon = microBlock ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
              const titleRowMt = "mt-0.5";
              const railShape = microBlock
                ? "top-0.5 bottom-0.5 w-[2px] rounded-none"
                : tinyBlock
                  ? "top-0.5 bottom-0.5 w-[2px] rounded-none"
                  : "top-1.5 bottom-1.5 w-[2px] rounded-full";

              return (
                <div
                  key={a.id}
                  id={`day-block-${a.source}-${a.id}`}
                  className={`group absolute left-0 right-0 border ${flatTop ? "rounded-t-none" : "rounded-t-lg"} ${flatBottom ? "rounded-b-none" : "rounded-b-lg"} ${s.blockBg} ${
                    isDragging
                      ? "border-secondary/60 shadow-lg opacity-90 cursor-grabbing"
                      : live
                        ? `${s.blockBorder} ring-2 ring-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.34)]`
                        : `${s.blockBorder} hover:border-secondary/50`
                  }`}
                  style={{
                    top: effectiveTop,
                    height: bh,
                    zIndex: isDragging ? 35 : live ? 15 : 10,
                    overflow: "visible",
                    transition: isDragging ? "none" : "box-shadow 0.15s",
                  }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[data-no-open="true"]')) return;
                    if (draggingId) return;
                    setInspectItem(a);
                  }}
                >
                  <div className={`absolute ${railShape} ${dotLeft} ${s.dot}`} />
                  <div className="flex items-center h-full overflow-hidden">
                    <div
                      className={`${gripW} h-full shrink-0 flex items-center justify-center touch-none ${
                        a.source === "routine" && a.derived
                          ? "text-muted-foreground/20 cursor-not-allowed"
                          : "text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing"
                      }`}
                      data-no-open="true"
                      onPointerDown={(e) => onGripDown(e, a)}
                      onPointerMove={onGripMove}
                      onPointerUp={onGripUp}
                      onPointerCancel={onGripCancel}
                    >
                      {tinyBlock ? (
                        <div className="h-3.5 w-3.5 grid place-items-center">
                          <div className="flex items-center gap-[1px]">
                            <span className="h-[2px] w-[2px] rounded-full bg-current" />
                            <span className="h-[2px] w-[2px] rounded-full bg-current" />
                          </div>
                        </div>
                      ) : (
                        <GripVertical className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className={`flex-1 min-w-0 h-full ${cPy} ${cPl} pr-0.5 text-left overflow-hidden`}>
                      {tinyBlock ? (
                        <div className="h-full flex items-center gap-1.5 leading-none">
                          {/* Fixed category lane preserves title alignment while using a true square marker. */}
                          <span className="w-11 shrink-0 flex items-center" aria-hidden="true">
                            <span className={`inline-block h-3 w-8 rounded-[2px] border ${s.chip} ${s.blockBorder} mx-1`} />
                          </span>
                          <span className="font-medium text-primary text-[10px] leading-none truncate">
                            {blockTitle}
                          </span>
                          {showTinySticky && (
                            <span
                              className={`shrink-0 rounded p-0.5 ${noteTone.chip}`}
                              title={noteLines.map((n) => n.text).join("\n")}
                              aria-label={t.chronos.today.notes}
                            >
                              <StickyNote className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className={isFortyFiveBlock && !showStickyPreview ? "h-full flex flex-col justify-center" : ""}>
                      {!compactBlock && (
                        <div className="flex items-center gap-1.5 text-[11px] num text-muted-foreground flex-wrap">
                          <span>{formatClock(a.start, bcp47)}–{formatClock(a.end, bcp47)}</span>
                          <span>·</span>
                          <span>{fmtDur(em - sm)}</span>
                          {live && <span className="text-secondary font-medium uppercase tracking-wider">· {t.chronos.today.now}</span>}
                          {a.source === "commitment" && <span className="text-[10px] uppercase tracking-wider text-amber-500/80">· {t.chronos.today.commitmentTag}</span>}
                        </div>
                      )}
                      <div className={`${titleRowMt} flex items-center gap-1.5`}>
                        {showCategoryChip && (
                          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip} font-medium shrink-0`}>
                            {t.common.kinds[a.kind]}
                          </span>
                        )}
                        {!showCategoryChip && (
                          <span className={`w-3 h-3 rounded-sm ${s.chip} shrink-0`} aria-hidden="true" />
                        )}
                        <span className={`${showInlineOneHourNotes ? "shrink min-w-0 max-w-[9rem]" : "min-w-0 flex-1"} font-medium text-primary truncate ${titleSz}`}>
                          {blockTitle}
                        </span>
                        {showInlineOneHourNotes && (
                          <span className="ml-0.5 flex min-w-0 max-w-[12.5rem] items-center gap-1 overflow-hidden" title={noteLines.map((n) => n.text).join("\n")}>
                            {noteLines.slice(0, 3).map((line, idx) => {
                              const tone = noteToneStyles[line.tone];
                              return (
                                <span key={`${line.text}-${idx}`} className={`min-w-0 rounded px-1 py-0.5 text-[9px] ${tone.bg} ${tone.text}`}>
                                  <span className="inline-flex min-w-0 items-center gap-1 align-middle">
                                    <span className={`h-1.5 w-1.5 rounded-[2px] ${tone.solid} shrink-0`} />
                                    <span className="truncate max-w-[5.25rem]">{line.text}</span>
                                  </span>
                                </span>
                              );
                            })}
                          </span>
                        )}
                        {showStickyBadge && (
                          <span
                            className={`shrink-0 rounded p-0.5 ${noteTone.chip}`}
                            title={noteLines.map((n) => n.text).join("\n")}
                            aria-label={t.chronos.today.notes}
                          >
                            <StickyNote className="h-2.5 w-2.5" />
                          </span>
                        )}
                        {showRightMetaLane && (
                        <div className="ml-auto shrink-0 flex items-center gap-1">
                          {showStickyMetaFallback && (
                            <span className={`max-w-[9.5rem] rounded px-1 py-0.5 text-[9px] ${noteTone.bg} ${noteTone.text}`} title={noteLines.map((n) => n.text).join("\n")}>
                              <span className="inline-flex items-center gap-1">
                                <StickyNote className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{noteLines[0].text}</span>
                              </span>
                            </span>
                          )}
                          {showCompactMeta && (
                            <span className="num text-[9px] text-muted-foreground/70">
                              {bh >= 30 ? `${formatClock(a.start, bcp47)} · ${fmtDur(em - sm)}` : formatClock(a.start, bcp47)}
                            </span>
                          )}
                        </div>
                        )}
                      </div>
                      {showStickyPreview && (
                        noteLines.length === 1 ? (
                          <div className={`mt-0.5 max-w-full rounded px-1.5 py-1 text-[10px] ${noteTone.bg} ${noteTone.text}`}>
                            <div className="inline-flex items-center gap-1">
                              <StickyNote className="h-2.5 w-2.5 shrink-0" />
                              <span className="line-clamp-1 leading-tight">
                                {renderLinkedText(noteLines[0].text)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-0.5 max-w-full rounded px-1.5 py-1 text-[10px] bg-muted/25">
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

                    {!(a.source === "routine" && a.derived) && (
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
          sleepWindow={data.meta.sleepWindow}
          onSaveWindow={(patch) => {
            updateSleepWindow(patch);
            setEditSleep(false);
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
  const [noteLines, setNoteLines] = useState<NoteLine[]>(() => parseNotes(item.notes));
  const dur = durationMin(start, end);

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
      endsNextDay: end <= start,
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
  onSaveWindow,
  onAddInstance,
  onClose,
}: {
  sleepWindow: { start: string; end: string };
  onSaveWindow: (patch: Partial<{ start: string; end: string }>) => void;
  onAddInstance: (start: string, end: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const [start, setStart] = useState(sleepWindow.start);
  const [end, setEnd] = useState(sleepWindow.end);
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
              {spansMidnight
                ? (bcp47.toLowerCase().startsWith("pt") ? "Cruza para o dia seguinte: atualiza os limites de sono do dia." : "Crosses into next day: updates the day-boundary sleep window.")
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
