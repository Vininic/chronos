import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Hourglass, Play, Pause, RotateCcw } from "lucide-react";
import { useTimer } from "@/lib/timer/TimerContext";
import { useSchedule } from "@/lib/schedule/store";
import { buildAgendaForDate } from "@/lib/schedule/agenda";
import { calcProgress } from "@/lib/schedule/workspace-engine";
import { timeToMinutes } from "@/lib/schedule/types";
import { safeKindStyle } from "@/components/dashboard/widgets";
import { useT } from "@/lib/i18n/I18nProvider";

function MiniHourglass({ ratio, size = 30 }: { ratio: number; size?: number }) {
  const r = Math.max(0, Math.min(1, ratio));
  const VW = 40, VH = 56;
  const capH = 5, capY = 3, neckW = 5, neckY = VH / 2;
  const bW = 28, bX = (VW - bW) / 2;

  const upper = `M${bX},${capY + capH} L${VW / 2 - neckW / 2},${neckY} L${VW / 2 + neckW / 2},${neckY} L${bX + bW},${capY + capH} Z`;
  const lower = `M${VW / 2 - neckW / 2},${neckY} L${bX},${VH - capY - capH} L${bX + bW},${VH - capY - capH} L${VW / 2 + neckW / 2},${neckY} Z`;
  const uH = neckY - (capY + capH);
  const lH = (VH - capY - capH) - neckY;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width={size} height={size * VH / VW}>
      <defs>
        <clipPath id="tc-u"><path d={upper} /></clipPath>
        <clipPath id="tc-l"><path d={lower} /></clipPath>
        <linearGradient id="tc-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.95" />
          <stop offset="100%" stopColor="hsl(35 75% 42%)" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path d={upper} fill="hsl(var(--secondary))" fillOpacity={0.07} />
      <path d={lower} fill="hsl(var(--secondary))" fillOpacity={0.07} />
      {r > 0.01 && (
        <rect x={0} y={capY + capH + uH - uH * r} width={VW} height={uH * r}
          fill="url(#tc-sand)" clipPath="url(#tc-u)" />
      )}
      {r < 0.99 && (
        <rect x={0} y={neckY} width={VW} height={lH * (1 - r)}
          fill="url(#tc-sand)" clipPath="url(#tc-l)" opacity={0.8} />
      )}
      {r > 0.03 && r < 0.97 && (
        <rect x={VW / 2 - 1} y={neckY - 4} width={2} height={8}
          fill="hsl(var(--secondary))" opacity={0.55} rx={1} />
      )}
      <path d={upper} fill="none" stroke="hsl(var(--secondary))" strokeWidth="1.2" opacity={0.4} />
      <path d={lower} fill="none" stroke="hsl(var(--secondary))" strokeWidth="1.2" opacity={0.4} />
      <rect x={bX - 1} y={capY} width={bW + 2} height={capH} rx={2} fill="hsl(var(--secondary))" opacity={0.55} />
      <rect x={bX - 1} y={VH - capY - capH} width={bW + 2} height={capH} rx={2} fill="hsl(var(--secondary))" opacity={0.55} />
    </svg>
  );
}

export function TimerCard() {
  const navigate = useNavigate();
  const timer = useTimer();
  const { data } = useSchedule();
  const t = useT();

  const { activeSession, currentWorkspaceBlock } = useMemo(() => {
    const agenda = buildAgendaForDate(data, new Date());

    // Active program session (workspace progress tracking)
    const sessionItem = agenda.find((a) => {
      const cat = data.categories.find((c) => c.id === a.kind);
      return cat?.workspace && a.workspace?._sessionStarted && !a.workspace?._sessionEnded;
    });
    let activeSession = null;
    if (sessionItem) {
      const cat = data.categories.find((c) => c.id === sessionItem.kind)!;
      const liveRuntime = sessionItem.source === "routine"
        ? (data.routine.find((r) => r.id === (sessionItem.sourceId ?? sessionItem.id))?.workspace ?? {})
        : (data.commitments.find((c) => c.id === sessionItem.id)?.workspace ?? {});
      activeSession = { item: sessionItem, cat, progress: calcProgress(liveRuntime, cat.workspace!) };
    }

    // Only workspace-enabled blocks currently happening (not sleep, not "Now" duplicates)
    const mn = new Date().getHours() * 60 + new Date().getMinutes();
    const dayBlocks = agenda.filter(
      (a) => a.kind !== "sleep" && !(a as { sleepBoundary?: boolean }).sleepBoundary,
    );
    const currentWorkspaceBlock = dayBlocks.find((a) => {
      const s = timeToMinutes(a.start);
      const e = timeToMinutes(a.end === "24:00" ? "23:59" : a.end);
      const cat = data.categories.find((c) => c.id === a.kind);
      return mn >= s && mn < e && !!cat?.workspace;
    }) ?? null;

    return { activeSession, currentWorkspaceBlock };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const blockStyle = currentWorkspaceBlock ? safeKindStyle(currentWorkspaceBlock.kind, data.categories) : null;

  const ratio = timer.target > 0 ? timer.seconds / timer.target : 0;
  const isIdle = !timer.running && !activeSession && !timer.activeBlock
    && (timer.seconds === timer.target || timer.target === 0);
  const hasActivity = !isIdle;

  // Card border/bg varies by state
  const cardClass = hasActivity
    ? "border-secondary/25 bg-secondary/5"
    : currentWorkspaceBlock
    ? "border-sidebar-border/60 bg-sidebar-accent/25"
    : "border-sidebar-border/30 bg-transparent";

  return (
    <div className={`w-full rounded-lg border px-3 py-2.5 flex items-center gap-2 transition-colors ${cardClass}`}>

      {/* ── Idle: workspace block currently happening ── */}
      {isIdle && currentWorkspaceBlock && blockStyle ? (
        <button
          onClick={() => navigate("/dashboard/focus")}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left group/timer"
        >
          <div className="shrink-0 h-[38px] w-[26px] flex items-center justify-center">
            <span
              className={`h-2.5 w-2.5 rounded-full ${blockStyle.dot} transition-transform group-hover/timer:scale-125`}
              style={blockStyle.dotStyle}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[9px] uppercase tracking-wider font-semibold leading-none text-secondary/75">
              Now
            </div>
            <div className="text-[11px] text-sidebar-foreground/80 truncate font-medium leading-tight mt-1 group-hover/timer:text-sidebar-foreground transition-colors">
              {currentWorkspaceBlock.titleCustom ?? currentWorkspaceBlock.title}
            </div>
            <div className="text-[9px] text-sidebar-foreground/35 num mt-0.5">
              {currentWorkspaceBlock.start}–{currentWorkspaceBlock.end}
            </div>
          </div>
        </button>

      /* ── Idle: no workspace block ── */
      ) : isIdle ? (
        <button
          onClick={() => navigate("/dashboard/focus")}
          className="flex items-center gap-3 flex-1 min-w-0 text-left group/timer"
        >
          <div className="h-[38px] w-[26px] flex items-center justify-center shrink-0">
            <Hourglass className="h-4.5 w-4.5 text-sidebar-foreground/20 group-hover/timer:text-sidebar-foreground/35 transition-colors" />
          </div>
          <div className="flex-1 min-w-0 text-[11px] text-sidebar-foreground/35 italic group-hover/timer:text-sidebar-foreground/50 transition-colors">
            {t.chronos.widgets.noTimerActive}
          </div>
        </button>

      /* ── Timer active / program session ── */
      ) : (
        <button
          onClick={() => navigate("/dashboard/focus")}
          className="flex items-center gap-3 flex-1 min-w-0 text-left group/timer"
        >
          <div className="shrink-0 relative">
            <MiniHourglass ratio={ratio} size={28} />
            {timer.running && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-secondary animate-pulse ring-2 ring-sidebar" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`font-display text-base num leading-none tabular-nums ${timer.running ? "text-secondary" : "text-sidebar-foreground/60"}`}>
                {timer.mm}:{timer.ss}
              </span>
              {timer.running && <span className="text-[9px] uppercase tracking-wider text-secondary/60">running</span>}
              {!timer.running && hasActivity && <span className="text-[9px] uppercase tracking-wider text-sidebar-foreground/40">paused</span>}
            </div>
            {activeSession ? (
              <div className="mt-0.5 min-w-0">
                <div className="text-[10px] text-sidebar-foreground/55 truncate leading-tight">{activeSession.cat.label}</div>
                {activeSession.progress.total > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-0.5 rounded-full bg-sidebar-border overflow-hidden">
                      <div className="h-full bg-secondary transition-all duration-300" style={{ width: `${Math.round((activeSession.progress.done / activeSession.progress.total) * 100)}%` }} />
                    </div>
                    <span className="text-[9px] text-sidebar-foreground/45 num shrink-0">{activeSession.progress.done}/{activeSession.progress.total}</span>
                  </div>
                )}
              </div>
            ) : timer.activeBlock?.title ? (
              <div className="mt-0.5 text-[10px] text-sidebar-foreground/55 truncate leading-tight">{timer.activeBlock.title}</div>
            ) : null}
          </div>
        </button>
      )}

      {/* Inline controls — only when a timer is running/paused */}
      {hasActivity && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={timer.togglePause}
            title={timer.running ? "Pause" : "Resume"}
            aria-label={timer.running ? "Pause timer" : "Resume timer"}
            className="h-7 w-7 rounded-md grid place-items-center text-sidebar-foreground/50 hover:text-secondary hover:bg-sidebar-accent/50 transition-colors"
          >
            {timer.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={timer.reset}
            title="Reset"
            aria-label="Reset timer"
            className="h-7 w-7 rounded-md grid place-items-center text-sidebar-foreground/50 hover:text-secondary hover:bg-sidebar-accent/50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
