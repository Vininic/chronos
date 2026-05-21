import { useEffect, useMemo, useRef, useState } from "react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { BlockKind, durationMin, timeToMinutes } from "@/lib/schedule/types";
import { kindStyle } from "./widgets";
import { useFmtDur, useI18n, useT } from "@/lib/i18n/I18nProvider";
import { isKnownDefaultBlockTitle, useScheduleText } from "@/lib/i18n/scheduleText";
import { ChevronLeft, ChevronRight, Clock, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
};

type FreeSlot = { type: "free"; id: string; start: string; end: string };

function snapTime(min: number) {
  const s = Math.round(min / SNAP) * SNAP;
  const c = Math.max(0, Math.min(23 * 60 + 59, s));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
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

function isSleepBlock(a: AgendaItem) {
  return a.kind === "sleep";
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
  return Math.max(36, ((timeToMinutes(e) - timeToMinutes(s)) / 60) * HOUR_PX - 4);
}

function freeHeight(s: string, e: string) {
  return Math.max(10, ((timeToMinutes(e) - timeToMinutes(s)) / 60) * HOUR_PX - 2);
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
  const liveId = isToday
    ? rawAgenda.find((a) => timeToMinutes(a.start) <= nowMin && nowMin < timeToMinutes(a.end))?.id
    : undefined;

  const sleepBlocks = useMemo(
    () => rawAgenda.filter((a) => isSleepBlock(a)).sort((a, b) => a.start.localeCompare(b.start)),
    [rawAgenda],
  );
  const nonSleepAgenda = useMemo(
    () => rawAgenda.filter((a) => !isSleepBlock(a)).sort((a, b) => a.start.localeCompare(b.start)),
    [rawAgenda],
  );
  const morningSleep = [...sleepBlocks].reverse().find((a) => timeToMinutes(a.end) <= 12 * 60);
  const eveningSleep = sleepBlocks.find((a) => timeToMinutes(a.start) >= 18 * 60);

  const defaultStartMin = timeToMinutes(data.meta.workdayStart);
  const defaultEndMin = timeToMinutes(data.meta.workdayEnd);

  let startMin = morningSleep ? timeToMinutes(morningSleep.end) : defaultStartMin;
  let endMin = eveningSleep ? timeToMinutes(eveningSleep.start) : defaultEndMin;

  const firstWorkStart = nonSleepAgenda.length > 0 ? timeToMinutes(nonSleepAgenda[0].start) : defaultStartMin;
  const lastWorkEnd = nonSleepAgenda.length > 0 ? timeToMinutes(nonSleepAgenda[nonSleepAgenda.length - 1].end) : defaultEndMin;

  startMin = Math.min(startMin, firstWorkStart);
  endMin = Math.max(endMin, lastWorkEnd);

  // Hard-cap the visible range to sleep boundaries so blocks can never push outside them
  if (morningSleep) startMin = Math.max(startMin, timeToMinutes(morningSleep.end));
  if (eveningSleep) endMin = Math.min(endMin, timeToMinutes(eveningSleep.start));

  if (endMin - startMin < 60) {
    startMin = defaultStartMin;
    endMin = defaultEndMin;
  }
  if (endMin - startMin < 60) {
    startMin = 0;
    endMin = 24 * 60;
  }

  const startHour = Math.floor(startMin / 60);
  const endHour = Math.ceil(endMin / 60);

  const timeline = useMemo(
    () => buildTimeline(nonSleepAgenda, startMin, endMin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(nonSleepAgenda), startMin, endMin],
  );

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

  const [expandedId, setExpandedId] = useState<string | null>(liveId ?? null);
  const [editItem, setEditItem] = useState<AgendaItem | null>(null);
  const [editSleep, setEditSleep] = useState<AgendaItem | null>(null);

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
    setExpandedId((p) => (p === a.id ? null : p));
  }

  const dateLabel = isToday
    ? t.chronos.today.eyebrow
    : selectedDate.toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "short" });

  const positionedTimeline = useMemo(() => {
    return timeline.map((item) => ({ item, top: topFor(item.start, startMin) + topBadgeLane }));
  }, [timeline, startMin, topBadgeLane]);

  const timelineHeight = totalHeight + topBadgeLane;

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
            {t.chronos.widgets.movements(rawAgenda.filter((a) => !isSleepBlock(a)).length)} · {fmtDur(rawAgenda.filter((a) => !isSleepBlock(a)).reduce((s, a) => s + durationMin(a.start, a.end), 0))}
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
          <ComposeBlockDialog />
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
                onClick={() => setEditSleep(morningSleep)}
                className="absolute right-0 bottom-[4px] block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
              >
                {bcp47.toLowerCase().startsWith("pt") ? `Sono até ${morningSleep.end}` : `Sleep until ${morningSleep.end}`}
              </button>
            </div>
          )}
          {eveningSleep && (
            <div
              className="absolute left-[68px] right-4 z-[20]"
              style={{ top: topFor(eveningSleep.start, startMin) + topBadgeLane }}
            >
              <button
                onClick={() => setEditSleep(eveningSleep)}
                className="ml-auto block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
              >
                {bcp47.toLowerCase().startsWith("pt") ? `Sono às ${eveningSleep.start}` : `Sleep at ${eveningSleep.start}`}
              </button>
            </div>
          )}

          <div className="absolute left-[68px] right-4 top-0 bottom-0 z-10">
            {positionedTimeline.map(({ item, top }) => {
              if ("type" in item && item.type === "free") {
                const fh = freeHeight(item.start, item.end);
                const dur = durationMin(item.start, item.end);
                return (
                  <div key={item.id} className="absolute left-0 right-0 rounded-lg border border-dashed border-border/40 bg-card/80 flex items-center px-3 gap-2" style={{ top, height: fh }}>
                    {fh > 20 && (
                      <span className="text-[10px] text-muted-foreground/45 uppercase tracking-wider flex-1 truncate">
                        {t.chronos.today.free} · {fmtDur(dur)}
                      </span>
                    )}
                    {fh > 42 && (
                      <ComposeBlockDialog
                        defaultStart={item.start}
                        defaultEnd={item.end}
                        trigger={<button className="h-6 w-6 rounded border border-dashed border-secondary/30 text-secondary/50 hover:text-secondary hover:border-secondary grid place-items-center transition-colors"><Plus className="h-3 w-3" /></button>} />
                    )}
                  </div>
                );
              }

              const a = item as AgendaItem;
              const sm = timeToMinutes(a.start);
              const em = timeToMinutes(a.end);
              const isDragging = draggingId === a.id;
              const preOffset = top - (topFor(a.start, startMin) + topBadgeLane);
              const effectiveTop = isDragging ? topFor(snapTime(sm + dragDeltaMin), startMin) + topBadgeLane + preOffset : top;
              const bh = blockHeight(a.start, a.end);
              const s = kindStyle[a.kind];
              const live = a.id === liveId;
              const expanded = a.id === expandedId;

              return (
                <div
                  key={a.id}
                  id={`day-block-${a.source}-${a.id}`}
                  className={`absolute left-0 right-0 rounded-lg border ${s.blockBg} ${
                    isDragging
                      ? "border-secondary/60 shadow-lg opacity-90 cursor-grabbing"
                      : live
                        ? `${s.blockBorder} ring-2 ring-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.34)]`
                        : `${s.blockBorder} hover:border-secondary/50`
                  }`}
                  style={{
                    top: effectiveTop,
                    height: bh,
                    zIndex: isDragging ? 35 : expanded ? 50 : live ? 15 : 10,
                    overflow: "visible",
                    transition: isDragging ? "none" : "box-shadow 0.15s",
                  }}
                >
                  <div className={`absolute top-1.5 bottom-1.5 left-7 w-[3px] rounded-full ${s.dot}`} />
                  <div className="flex items-center h-full">
                    <div
                      className={`w-7 h-full shrink-0 flex items-center justify-center touch-none ${
                        a.source === "routine" && a.derived
                          ? "text-muted-foreground/20 cursor-not-allowed"
                          : "text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing"
                      }`}
                      onPointerDown={(e) => onGripDown(e, a)}
                      onPointerMove={onGripMove}
                      onPointerUp={onGripUp}
                      onPointerCancel={onGripCancel}
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </div>

                    <button onClick={() => setExpandedId(expanded ? null : a.id)} className="flex-1 min-w-0 h-full py-1.5 pl-4 pr-1 text-left overflow-hidden">
                      <div className="flex items-center gap-1.5 text-[11px] num text-muted-foreground flex-wrap">
                        <span>{formatClock(a.start, bcp47)}–{formatClock(a.end, bcp47)}</span>
                        <span>·</span>
                        <span>{fmtDur(em - sm)}</span>
                        {live && <span className="text-secondary font-medium uppercase tracking-wider">· {t.chronos.today.now}</span>}
                        {a.source === "commitment" && <span className="text-[10px] uppercase tracking-wider text-amber-500/80">· {t.chronos.today.commitmentTag}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip} font-medium shrink-0`}>
                          {t.common.kinds[a.kind]}
                        </span>
                        <span className="text-sm font-medium text-primary truncate">{scheduleText.blockTitle(a.title, a.titleCustom)}</span>
                      </div>
                    </button>

                    {!(a.source === "routine" && a.derived) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditItem(a); }}
                        className="shrink-0 w-9 h-full flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 rounded-r-lg transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {expanded && (
                    <div className="absolute left-8 right-2 top-[calc(100%+4px)] border border-secondary/20 bg-card shadow-elevated rounded-md px-3 py-2 z-[60]">
                      {a.notes
                        ? <p className="text-xs text-foreground/85 leading-relaxed max-h-24 overflow-auto">{a.notes}</p>
                        : <p className="text-xs text-muted-foreground/70 italic">{t.chronos.today.notes}</p>}
                    </div>
                  )}
                </div>
              );
            })}

            {rawAgenda.filter((a) => !isSleepBlock(a)).length === 0 && (
              <div className="absolute inset-x-0 top-24 mx-auto max-w-xs rounded-lg border border-dashed border-border p-10 text-center">
                <p className="text-sm text-muted-foreground">{t.chronos.today.noBlocks}</p>
                <div className="mt-3"><ComposeBlockDialog /></div>
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
          item={editSleep}
          onSave={(patch) => {
            updateSleepWindow(patch);
            setEditSleep(null);
          }}
          onClose={() => setEditSleep(null)}
        />
      )}
    </div>
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
  const [notes, setNotes] = useState(item.notes ?? "");
  const dur = start < end ? durationMin(start, end) : 0;

  function save() {
    const next = title.trim();
    if (!next) return;
    if (item.source === "routine" && start >= end) { toast({ title: t.chronos.dialog.endAfterStart }); return; }
    const defaultTitle = scheduleText.blockTitle(item.title);
    const patch: Partial<AgendaItem> & { titleCustom?: string; endsNextDay?: boolean } = {
      start,
      end,
      kind,
      endsNextDay: item.source === "commitment" ? end <= start : undefined,
      notes: notes.trim(),
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
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.chronos.dialog.notesPlaceholder} className="resize-none" />
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
  item,
  onSave,
  onClose,
}: {
  item: AgendaItem;
  onSave: (patch: Partial<{ start: string; end: string }>) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const isMorning = timeToMinutes(item.end) <= 12 * 60;
  // Morning sleep: only wake time (end) is meaningful. Evening: only bedtime (start).
  const [time, setTime] = useState(isMorning ? item.end : item.start);

  function save() {
    if (isMorning) {
      if (!time) return;
      onSave({ end: time });
    } else {
      if (!time) return;
      onSave({ start: time });
    }
  }

  const label = isMorning
    ? (bcp47.toLowerCase().startsWith("pt") ? "Acordar às" : "Wake up at")
    : (bcp47.toLowerCase().startsWith("pt") ? "Dormir às" : "Bedtime at");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">
            {bcp47.toLowerCase().startsWith("pt") ? "Sono" : "Sleep"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
            <TimeSelect value={time} onValueChange={setTime} bcp47={bcp47} className="h-9" />
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
