import type { AgendaItem } from "@/lib/schedule/agenda";
import { Pencil, ArrowRightToLine } from "lucide-react";

interface SleepSplitDisplay {
  cut: { date: string; start: string; end: string };
  startMin: number;
  endMin: number;
  durMin: number;
  laneMin: number;
}

interface TimelineGridProps {
  isToday: boolean;
  projectedNowMin: number;
  nowRenderMin: number;
  nowInsideSleepCut: boolean;
  isNowClamped: boolean;
  projectMinute: (m: number) => number;
  topBadgeLane: number;
  hours: number[];
  startMin: number;
  HOUR_PX: number;
  timelineHeight: number;
  timelineContentHeight: number;
  sleepSplits: SleepSplitDisplay[];
  bcp47: string;
  formatClock: (t: string, l: string) => string;
  formatHourLabel: (h: number, l: string) => string;
  showStartBoundaryMarker: boolean;
  showEndBoundaryMarker: boolean;
  wakeBoundaryText: string;
  bedtimeBoundaryText: string;
  draggingId: string | null;
  nonSleepAgenda: AgendaItem[];
  nowMin: number;
  commitmentDropPos: { start: string; duration: number } | null;
  topForProjected: (time: string) => number;
  STACK_GAP_PX: number;
  onEditSleep: () => void;
}

export function TimelineGrid({
  isToday,
  projectedNowMin,
  nowRenderMin,
  nowInsideSleepCut,
  isNowClamped,
  projectMinute,
  topBadgeLane,
  hours,
  startMin,
  HOUR_PX,
  timelineHeight,
  timelineContentHeight,
  sleepSplits,
  bcp47,
  formatClock,
  formatHourLabel,
  showStartBoundaryMarker,
  showEndBoundaryMarker,
  wakeBoundaryText,
  bedtimeBoundaryText,
  draggingId,
  nonSleepAgenda,
  nowMin,
  commitmentDropPos,
  topForProjected,
  STACK_GAP_PX,
  onEditSleep,
}: TimelineGridProps) {
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  return (
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
              const inSleepCut = sleepSplits.some((s) => qMin > s.startMin && qMin < s.endMin);
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
              : (draggingId !== null || nonSleepAgenda.some((a) => toMin(a.start) <= nowMin && nowMin < toMin(a.end))
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

      <div className="absolute left-[68px] right-4 z-[20]" style={{ top: 2, height: topBadgeLane }}>
        <button
          onClick={onEditSleep}
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
            onClick={onEditSleep}
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary/80 shadow-[0_0_0_2px_hsl(var(--card))] hover:bg-primary/20 hover:border-primary/50 transition-colors"
          >
            {bedtimeBoundaryText}
          </button>
        </div>
      </div>

      {sleepSplits.map((sleepSplit, index) => {
        const splitTop = topForProjected(snapTime(sleepSplit.startMin)) + topBadgeLane;
        const isPt = bcp47.toLowerCase().startsWith("pt");
        const splitBottom = topForProjected(snapTime(sleepSplit.endMin)) + topBadgeLane;
        const splitAvailable = Math.max(0, splitBottom - splitTop);
        const splitTarget = Math.max(30, splitAvailable - 2);
        const splitHeight = Math.min(splitTarget, splitAvailable);
        const centeredTop = (splitBottom + splitTop - STACK_GAP_PX - splitHeight) / 2;
        const splitTopOffset = Math.max(splitTop - STACK_GAP_PX, Math.min(centeredTop, splitBottom - splitHeight));
        return (
          <button
            key={`${sleepSplit.cut.date}-${sleepSplit.cut.start}-${sleepSplit.cut.end}-${index}`}
            onClick={onEditSleep}
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
            <div
              className="absolute left-0 right-0 z-30 pointer-events-none"
              style={{
                top: topForProjected(commitmentDropPos.start) + topBadgeLane,
                height: 0,
                borderTop: "2px solid rgba(251, 191, 36, 0.6)",
                boxShadow: "0 0 12px rgba(251, 191, 36, 0.35)",
              }}
            />
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
      </div>
    </div>
  );
}

function snapTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
