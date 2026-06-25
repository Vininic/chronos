import type { AgendaItem } from "@/lib/schedule/agenda";
import type { ScheduleData, WorkspaceRuntime, RoutineBlock, Commitment } from "@/lib/schedule/types";
import { SNAP, snapTime, timeToMinutes, durationMin } from "@/lib/schedule/types";
import { safeKindStyle, toCssColor, alpha } from "../widgets";
import { isBoundarySleepBlock, formatClock, blockHeight, freeHeight, HOUR_PX } from "@/lib/schedule/planner-format";
import type { FreeSlot } from "@/lib/schedule/planner-format";
import { parseNotes, renderLinkedText, noteToneStyles } from "@/lib/schedule/planner-notes";
import { ComposeBlockDialog } from "../ComposeBlockDialog";
import { BlockSessionBadge } from "../SessionView";
import { ArrowDownToLine, ArrowUpToLine, GripVertical, Pencil, Plus, StickyNote, CheckCircle2 } from "lucide-react";
import type React from "react";

interface TimelineBlockProps {
  item: AgendaItem | FreeSlot;
  top: number;
  height: number;
  data: ScheduleData;
  routineById: Map<string, RoutineBlock>;
  commitmentById: Map<string, Commitment>;
  bcp47: string;
  fmtDur: (min: number) => string;
  scheduleText: {
    categoryLabel: (kind: string, label: string, labelCustom?: string) => string;
    blockTitle: (title: string, titleCustom?: string) => string;
  };
  t: Record<string, any>;
  topBadgeLane: number;
  topForProjected: (time: string) => number;
  timelineContentHeight: number;
  selectedDate: Date;
  selectedDateIso: string;
  draggingId: string | null;
  dragDeltaMin: number;
  dragState: React.MutableRefObject<any>;
  dragLimitHint: string | null;
  dragTransitionHint: { edge: string; pending: boolean; direction: string } | null;
  hasDraggedRef: React.MutableRefObject<boolean>;
  liveId: string | undefined;
  assignGoalId: string | null;
  trackBlockForGoal: (goalId: string, blockKey: string) => void;
  isBlockTrackedForAnyGoal: (blockKey: string) => boolean;
  onGripDown: (e: React.PointerEvent, a: AgendaItem) => void;
  onEditItem: (a: AgendaItem) => void;
  onInspectItem: (a: AgendaItem) => void;
  onEditSleep: () => void;
}

export function TimelineBlock({
  item,
  top,
  height,
  data,
  routineById,
  commitmentById,
  bcp47,
  fmtDur,
  scheduleText,
  t,
  topBadgeLane,
  topForProjected,
  timelineContentHeight,
  selectedDate,
  selectedDateIso,
  draggingId,
  dragDeltaMin,
  dragState,
  dragLimitHint,
  dragTransitionHint,
  hasDraggedRef,
  liveId,
  assignGoalId,
  trackBlockForGoal,
  isBlockTrackedForAnyGoal,
  onGripDown,
  onEditItem,
  onInspectItem,
  onEditSleep,
}: TimelineBlockProps) {
  if ("type" in item && item.type === "free") {
    const fh = height;
    const dur = durationMin(item.start, item.end);
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

  const tier: "full" | "hour" | "compact" | "micro" =
    blockMinutes >= 75 ? "full"
    : blockMinutes === 60 ? "hour"
    : blockMinutes <= 15 ? "micro"
    : "compact";

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

  const isMicro   = tier === "micro";
  const isCompact = tier === "compact";
  const isHour    = tier === "hour";
  const isFull    = tier === "full";

  const showNotesRight  = isHour && hasNotes;
  const previewLineCount = bh >= 62 ? 2 : bh >= 38 ? 1 : 0;
  const showNotesBelow  = isFull && hasNotes && previewLineCount > 0;
  const showStickyBadge = hasNotes && !showNotesRight && !showNotesBelow;

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
          onEditSleep();
          return;
        }
        if (hasDraggedRef.current) return;
        if (draggingId) return;
        onInspectItem(a);
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
              <BlockBadges a={a} tier="micro" data={data} onQuickAccess={onInspectItem} />
            </div>
          )}

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
                <BlockBadges a={a} tier="compact" data={data} onQuickAccess={onInspectItem} />
              </div>
            </div>
          )}

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
                <BlockBadges a={a} tier="hour" data={data} onQuickAccess={onInspectItem} />
              </div>
            </div>
          )}

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
                <BlockBadges a={a} tier="full" data={data} onQuickAccess={onInspectItem} />
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
            onClick={(e) => { e.stopPropagation(); onEditItem(a); }}
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
}

function BlockBadges({ a, tier, data, onQuickAccess }: {
  a: AgendaItem;
  tier: "micro" | "compact" | "hour" | "full";
  data: ScheduleData;
  onQuickAccess: (a: AgendaItem) => void;
}) {
  const cat = data.categories.find((c) => c.id === a.kind);
  if (!cat?.workspace) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onQuickAccess(a); }}
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
