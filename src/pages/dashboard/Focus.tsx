import { useState, useMemo } from "react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { durationMin, timeToMinutes } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Brain, Pause, Play, RotateCcw, ChevronRight } from "lucide-react";
import { FocusCategoryPicker, kindStyle, TAILWIND_TO_HEX } from "@/components/dashboard/widgets";
import { BlockKind } from "@/lib/schedule/types";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { toast } from "@/hooks/use-toast";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { useTimer } from "@/lib/timer/TimerContext";
import { SessionView } from "@/components/dashboard/SessionView";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { calcProgress } from "@/lib/schedule/workspace-engine";

// ── Hourglass SVG ────────────────────────────────────────────────────────────
// A detailed 3D-looking hourglass. ratio=1 full (start), ratio=0 empty (done).
function HourglassSVG({ ratio, size = 140 }: { ratio: number; size?: number }) {
  const r = Math.max(0, Math.min(1, ratio));

  // Geometry — hourglass defined in a 100×160 viewbox
  // Upper bulb: wide trapezoid narrowing to neck
  // Lower bulb: narrow neck widening to base
  const VW = 100, VH = 160;
  const capH = 10, capY = 8;
  const neckW = 7, neckY = VH / 2;
  const bulbTopW = 72, bulbTopX = (VW - bulbTopW) / 2;
  const bulbBotW = 72, bulbBotX = (VW - bulbBotW) / 2;

  // Upper glass: trapezoid from top-wide to neck-narrow
  const upperLeft  = `M${bulbTopX},${capY + capH} L${VW / 2 - neckW / 2},${neckY}`;
  const upperRight = `L${VW / 2 + neckW / 2},${neckY} L${bulbTopX + bulbTopW},${capY + capH}`;
  const upperPath = `${upperLeft} ${upperRight} Z`;

  // Lower glass: trapezoid from neck-narrow to bottom-wide
  const lowerPath = `M${VW / 2 - neckW / 2},${neckY} L${bulbBotX},${VH - capY - capH} L${bulbBotX + bulbBotW},${VH - capY - capH} L${VW / 2 + neckW / 2},${neckY} Z`;

  // Sand heights
  const upperBulbH = neckY - (capY + capH);   // total height of upper bulb
  const lowerBulbH = (VH - capY - capH) - neckY; // total height of lower bulb
  const upperSandH = upperBulbH * r;
  const lowerSandH = lowerBulbH * (1 - r);

  // Sand stream — thin rect at neck, animated by opacity
  const streamH = 12;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={size}
      height={size * (VH / VW)}
      className="drop-shadow-lg"
      style={{ filter: "drop-shadow(0 4px 12px hsl(var(--secondary)/0.25))" }}
    >
      <defs>
        <clipPath id="hg-upper-clip"><path d={upperPath} /></clipPath>
        <clipPath id="hg-lower-clip"><path d={lowerPath} /></clipPath>

        {/* Sand gradient — warm golden */}
        <linearGradient id="hg-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(35 80% 45%)" stopOpacity="0.85" />
        </linearGradient>

        {/* Glass surface sheen — light reflection on left edge */}
        <linearGradient id="hg-glass-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
          <stop offset="40%" stopColor="hsl(var(--primary))" stopOpacity="0.04" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.10" />
        </linearGradient>

        {/* Glass fill — subtle interior tint */}
        <linearGradient id="hg-glass-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.6" />
          <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.3" />
        </linearGradient>

        {/* Cap gradient — metallic look */}
        <linearGradient id="hg-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.65" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* ── Glass body fill ── */}
      <path d={upperPath} fill="url(#hg-glass-fill)" />
      <path d={lowerPath} fill="url(#hg-glass-fill)" />

      {/* ── Upper sand — drains from bottom as r decreases ── */}
      {r > 0.005 && (
        <rect
          x={0} y={capY + capH + upperBulbH - upperSandH}
          width={VW} height={upperSandH}
          fill="url(#hg-sand)"
          clipPath="url(#hg-upper-clip)"
        />
      )}

      {/* ── Lower sand — fills from top as r decreases ── */}
      {r < 0.995 && (
        <rect
          x={0} y={neckY}
          width={VW} height={lowerSandH}
          fill="url(#hg-sand)"
          clipPath="url(#hg-lower-clip)"
          opacity={0.9}
        />
      )}

      {/* ── Sand stream at neck ── */}
      {r > 0.02 && r < 0.98 && (
        <rect
          x={VW / 2 - 1.5} y={neckY - streamH / 2}
          width={3} height={streamH}
          fill="hsl(var(--secondary))"
          opacity={0.6}
          rx={1.5}
        />
      )}

      {/* ── Glass outline — upper bulb ── */}
      <path
        d={upperPath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity={0.35}
      />
      {/* ── Glass outline — lower bulb ── */}
      <path
        d={lowerPath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity={0.35}
      />

      {/* ── Glass sheen — light catching left edge ── */}
      <path d={upperPath} fill="url(#hg-glass-sheen)" />
      <path d={lowerPath} fill="url(#hg-glass-sheen)" />

      {/* ── Highlight — left inner edge of upper bulb ── */}
      <line
        x1={bulbTopX + 4} y1={capY + capH + 4}
        x2={VW / 2 - neckW / 2 + 2} y2={neckY - 4}
        stroke="white" strokeWidth="1.5" opacity={0.12} strokeLinecap="round"
      />

      {/* ── Top cap (frame) ── */}
      <rect
        x={bulbTopX - 2} y={capY}
        width={bulbTopW + 4} height={capH}
        rx={3} fill="url(#hg-cap)"
      />
      {/* cap top sheen */}
      <rect
        x={bulbTopX} y={capY + 1}
        width={bulbTopW} height={3}
        rx={1.5} fill="white" opacity={0.15}
      />

      {/* ── Bottom cap (frame) ── */}
      <rect
        x={bulbBotX - 2} y={VH - capY - capH}
        width={bulbBotW + 4} height={capH}
        rx={3} fill="url(#hg-cap)"
      />
      {/* cap bottom sheen */}
      <rect
        x={bulbBotX} y={VH - capY - capH + 1}
        width={bulbBotW} height={3}
        rx={1.5} fill="white" opacity={0.15}
      />
    </svg>
  );
}

// ── Duration pill button ─────────────────────────────────────────────────────
function DurationPill({ minutes, active, onClick }: { minutes: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all border ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
          : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary"
      }`}
    >
      {minutes}m
    </button>
  );
}

// ── Main Focus page ──────────────────────────────────────────────────────────
export default function Focus() {
  const { data, updateRoutine, updateCommitment } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const timer = useTimer();
  const focusIds = data.meta.focusCategoryIds ?? [];
  const [previewBlock, setPreviewBlock] = useState<{ title: string; start: string; end: string; kind: string } | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);

  const activeSession = useMemo(() => {
    const agenda = buildAgendaForDate(data, new Date());
    const item = agenda.find((a) => {
      const cat = data.categories.find((c) => c.id === a.kind);
      return cat?.workspace && ((a as Record<string, unknown>).workspace as Record<string, unknown>)?._sessionStarted && !((a as Record<string, unknown>).workspace as Record<string, unknown>)?._sessionEnded;
    });
    if (!item) return null;
    const cat = data.categories.find((c) => c.id === item.kind);
    return cat?.workspace ? { item, cat } : null;
  }, [data]);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (focusIds.length === 0) {
    return (
      <>
        <header className="mb-7">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.eyebrow}</div>
          <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.focus.title}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.focus.lead}</p>
        </header>
        <div className="chronos-card p-8">
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.focus}</div>
            <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.focusPickCategory}</h3>
          </div>
          <FocusCategoryPicker />
        </div>
      </>
    );
  }

  const todays = buildAgendaForDate(data, new Date()).filter((a) => focusIds.includes(a.kind));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const activeScheduled = todays.find((b) => timeToMinutes(b.start) <= nowMin && nowMin < timeToMinutes(b.end));
  const nextScheduled = todays.find((b) => timeToMinutes(b.start) > nowMin);
  const upcoming = data.routine.filter((r) => focusIds.includes(r.kind));

  const previewDot = kindStyle[(previewBlock?.kind ?? activeScheduled?.kind ?? "deep") as BlockKind]?.dot ?? "bg-primary";
  const previewColor = TAILWIND_TO_HEX[previewDot] ?? "hsl(var(--primary))";
  const ratio = timer.target > 0 ? timer.seconds / timer.target : 1;

  // Active session progress for the integrated card
  const sessionProgress = activeSession
    ? calcProgress(
        // live runtime from store
        activeSession.item.source === "routine"
          ? (data.routine.find(r => r.id === ((activeSession.item as any).sourceId ?? activeSession.item.id))?.workspace ?? {})
          : (data.commitments.find(c => c.id === activeSession.item.id)?.workspace ?? {}),
        activeSession.cat.workspace!
      )
    : { done: 0, total: 0 };

  return (
    <>
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.focus.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.focus.lead}</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── LEFT: main timer column ─────────────────────────────────────── */}
        <div className="w-full lg:flex-1 min-w-0 space-y-5">

          {/* Timer card — unified with active block info */}
          <div className="chronos-card-elevated overflow-hidden">

            {/* Active block banner — only when a block is being timed */}
            {(previewBlock || activeScheduled) && (
              <div className="flex items-center gap-3 border-b border-border/20 px-6 py-3 bg-muted/25">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: previewColor }} />
                <span className="text-sm text-primary font-medium truncate flex-1">
                  {previewBlock?.title ?? scheduleText.blockTitle(activeScheduled!.title, activeScheduled!.titleCustom)}
                </span>
                <span className="text-xs text-muted-foreground num shrink-0">
                  {(previewBlock ?? activeScheduled)!.start}–{(previewBlock ?? activeScheduled)!.end}
                </span>
                {previewBlock && (
                  <span className="text-[10px] uppercase tracking-wider text-secondary shrink-0 flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-secondary animate-pulse" />
                    {t.chronos.focus.inProgress}
                  </span>
                )}
                {!previewBlock && activeScheduled && (
                  <Button size="sm" className="h-7 shrink-0 text-xs" onClick={() => {
                    const mins = Math.max(15, durationMin(activeScheduled.start, activeScheduled.end));
                    timer.startScheduled(mins, { title: activeScheduled.title, start: activeScheduled.start, end: activeScheduled.end, kind: activeScheduled.kind });
                    setPreviewBlock({ title: activeScheduled.title, start: activeScheduled.start, end: activeScheduled.end, kind: activeScheduled.kind });
                    toast({ title: t.chronos.focus.focusBlockStarted, description: `${scheduleText.blockTitle(activeScheduled.title)} · ${activeScheduled.start}–${activeScheduled.end}` });
                  }}>
                    {t.chronos.focus.startWhenBegins}
                  </Button>
                )}
              </div>
            )}

            {/* Hourglass + timer display */}
            <div className="px-8 pt-8 pb-6 flex flex-col items-center gap-5">
              <HourglassSVG ratio={ratio} size={150} />

              <div className="text-center space-y-1">
                <div className="font-display text-6xl leading-none text-primary num tracking-tight tabular-nums">
                  {timer.mm}<span className="text-secondary/70 mx-0.5">:</span>{timer.ss}
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
                  {timer.running ? t.chronos.focus.sealed : t.chronos.focus.sealed}
                </div>
              </div>

              {/* Duration presets */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {[25, 45, 60, 90].map((m) => (
                  <DurationPill
                    key={m}
                    minutes={m}
                    active={timer.target === m * 60}
                    onClick={() => { timer.start(m); setPreviewBlock(null); }}
                  />
                ))}
              </div>

              {/* Play / Pause / Reset */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { timer.reset(); setPreviewBlock(null); }}
                  className="h-10 w-10 rounded-full border border-border/50 grid place-items-center text-muted-foreground hover:text-primary hover:border-border/80 transition-colors"
                  title="Reset"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={timer.togglePause}
                  className="h-16 w-16 rounded-full bg-secondary text-primary-deep grid place-items-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
                >
                  {timer.running
                    ? <Pause className="h-6 w-6" />
                    : <Play className="h-6 w-6 ml-0.5" />}
                </button>
                {/* Spacer for symmetry */}
                <div className="h-10 w-10" />
              </div>
            </div>

            {/* ── Active session — integrated at the bottom of the timer card ── */}
            {activeSession && (
              <div className="border-t border-border/20 mx-0">
                <button
                  onClick={() => setSessionOpen(true)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/20 transition-colors group"
                >
                  {/* Session progress ring */}
                  {sessionProgress.total > 0 && (
                    <svg viewBox="0 0 36 36" className="h-9 w-9 shrink-0 -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                      <circle
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke="hsl(var(--secondary))"
                        strokeWidth="3"
                        strokeDasharray={`${2 * Math.PI * 15}`}
                        strokeDashoffset={`${2 * Math.PI * 15 * (1 - sessionProgress.done / sessionProgress.total)}`}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                  )}
                  {sessionProgress.total === 0 && (
                    <div className="h-9 w-9 rounded-full bg-secondary/10 grid place-items-center shrink-0">
                      <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">Active session</span>
                      <span className="h-1 w-1 rounded-full bg-secondary animate-pulse" />
                    </div>
                    <div className="text-sm font-medium text-primary truncate mt-0.5">
                      {activeSession.cat.label}
                    </div>
                    {sessionProgress.total > 0 && (
                      <div className="text-[11px] text-muted-foreground/60 num mt-0.5">
                        {sessionProgress.done} / {sessionProgress.total} · {Math.round((sessionProgress.done / sessionProgress.total) * 100)}%
                      </div>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
                </button>

                {/* Thin progress bar at very bottom */}
                {sessionProgress.total > 0 && (
                  <div className="h-0.5 bg-muted/30">
                    <div
                      className="h-full bg-secondary transition-all duration-500"
                      style={{ width: `${Math.round((sessionProgress.done / sessionProgress.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Category picker */}
          <div className="chronos-card p-4"><FocusCategoryPicker /></div>

          {/* Routine deep work table */}
          <div className="chronos-card p-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.recurringDepth}</div>
            <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.focus.recurringTitle}</h3>
            <table className="w-full mt-4 text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">{t.chronos.focus.tableDay}</th>
                  <th className="text-left">{t.chronos.focus.tableTitle}</th>
                  <th className="text-right">{t.chronos.focus.tableStart}</th>
                  <th className="text-right">{t.chronos.focus.tableEnd}</th>
                  <th className="text-right">{t.chronos.focus.tableDuration}</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2.5 text-muted-foreground">{t.common.days.short[r.day]}</td>
                    <td className="text-primary py-2.5">
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${kindStyle[r.kind as BlockKind]?.dot ?? "bg-primary"}`} />
                        {scheduleText.blockTitle(r.title, r.titleCustom)}
                      </span>
                    </td>
                    <td className="text-right num">{r.start}</td>
                    <td className="text-right num">{r.end}</td>
                    <td className="text-right num text-secondary">{fmtDur(durationMin(r.start, r.end))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── RIGHT: context sidebar ─────────────────────────────────────── */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">

          {/* Today's focus blocks */}
          <div className="chronos-card p-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.todaysDepth}</div>
            <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.focus.composed(todays.length)}</h3>

            {(activeScheduled || nextScheduled) && (
              <div className="mt-4 rounded-lg border border-secondary/25 bg-secondary/5 p-3.5">
                <div className="text-[10px] uppercase tracking-[0.18em] text-secondary mb-1.5">{t.chronos.focus.scheduledFocus}</div>
                {activeScheduled ? (
                  <>
                    <div className="text-sm text-primary font-medium">{scheduleText.blockTitle(activeScheduled.title, activeScheduled.titleCustom)}</div>
                    <div className="text-[11px] text-muted-foreground num">{activeScheduled.start}–{activeScheduled.end}</div>
                  </>
                ) : nextScheduled ? (
                  <>
                    <div className="text-sm text-primary font-medium">{scheduleText.blockTitle(nextScheduled.title, nextScheduled.titleCustom)}</div>
                    <div className="text-[11px] text-muted-foreground num">{nextScheduled.start}–{nextScheduled.end}</div>
                  </>
                ) : null}
              </div>
            )}

            <ul className="mt-4 space-y-3">
              {todays.length === 0 && (
                <li className="text-sm text-muted-foreground italic">{t.chronos.focus.noDeepToday}</li>
              )}
              {todays.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary/8 grid place-items-center shrink-0">
                    <Brain className="h-4 w-4 text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-primary truncate">{scheduleText.blockTitle(s.title, s.titleCustom)}</div>
                    <div className="text-[11px] text-muted-foreground num">{s.start}–{s.end} · {fmtDur(durationMin(s.start, s.end))}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5">
              <ComposeBlockDialog
                trigger={<Button variant="outline" className="w-full">{t.chronos.focus.addDeep}</Button>}
                defaultKind={focusIds[0] ?? "deep"}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Session dialog (opened from integrated bottom strip) ─────────── */}
      {activeSession && (
        <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[min(88vh,calc(100dvh-2rem))] overflow-hidden flex flex-col p-0">
            {/* Sticky header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 shrink-0">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Session</div>
                <div className="text-base font-medium text-primary">{activeSession.cat.label}</div>
              </div>
              {timer.running && (
                <div className="flex items-center gap-2 text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
                  <span className="font-display text-xl num">{timer.mm}:{timer.ss}</span>
                </div>
              )}
            </div>
            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-5">
              <SessionView
                structure={activeSession.cat.workspace!}
                runtime={
                  activeSession.item.source === "routine"
                    ? (data.routine.find(r => r.id === ((activeSession.item as any).sourceId ?? activeSession.item.id))?.workspace ?? {})
                    : (data.commitments.find(c => c.id === activeSession.item.id)?.workspace ?? {})
                }
                onChange={(r) => {
                  const id = (activeSession.item as any).sourceId ?? activeSession.item.id;
                  if (activeSession.item.source === "routine") {
                    updateRoutine(id, { workspace: r });
                  } else {
                    updateCommitment(id, { workspace: r });
                  }
                }}
                onClose={() => setSessionOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
