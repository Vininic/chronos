import { useState, useMemo } from "react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { durationMin, timeToMinutes } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Brain, Pause, Play, RotateCcw } from "lucide-react";
import { FocusCategoryPicker, kindStyle, TAILWIND_TO_HEX } from "@/components/dashboard/widgets";
import { BlockKind } from "@/lib/schedule/types";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { toast } from "@/hooks/use-toast";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { useTimer } from "@/lib/timer/TimerContext";
import { BlockSessionBadge, SessionView } from "@/components/dashboard/SessionView";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { calcProgress } from "@/lib/schedule/workspace-engine";

function HourglassSVG({ ratio }: { ratio: number }) {
  const r = Math.max(0, Math.min(1, ratio));
  const W = 120, H = 180;
  const neckY = H / 2;
  const neckW = 6;
  const upperPath = `M20,20 L${W - 20},20 L${W / 2 + neckW / 2},${neckY} L${W / 2 - neckW / 2},${neckY} Z`;
  const lowerPath = `M${W / 2 - neckW / 2},${neckY} L${W / 2 + neckW / 2},${neckY} L${W - 20},${H - 20} L20,${H - 20} Z`;
  const upperSandH = (neckY - 20) * r;
  const lowerSandH = (H - 20 - neckY) * (1 - r);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={100} height={150} className="drop-shadow-sm">
      <defs>
        <clipPath id="upperClip">
          <path d={upperPath} />
        </clipPath>
        <clipPath id="lowerClip">
          <path d={lowerPath} />
        </clipPath>
        <linearGradient id="sandGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      <path d={upperPath} fill="url(#glassGrad)" />
      <path d={lowerPath} fill="url(#glassGrad)" />

      <rect x={0} y={20} width={W} height={upperSandH} fill="url(#sandGrad)" clipPath="url(#upperClip)" />
      <rect x={0} y={neckY} width={W} height={lowerSandH} fill="url(#sandGrad)" clipPath="url(#lowerClip)" opacity={0.7} />

      {r > 0.02 && r < 0.98 && (
        <rect x={W / 2 - 1.5} y={neckY - 4} width={3} height={8} fill="hsl(var(--secondary))" opacity={0.5} rx={1} />
      )}

      <path d={upperPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" opacity={0.4} />
      <path d={lowerPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" opacity={0.4} />

      <rect x={16} y={14} width={W - 32} height={8} rx={3} fill="hsl(var(--primary))" opacity={0.5} />
      <rect x={16} y={H - 22} width={W - 32} height={8} rx={3} fill="hsl(var(--primary))" opacity={0.5} />
    </svg>
  );
}

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
      return cat?.workspace && a.workspace?._sessionStarted && !a.workspace?._sessionEnded;
    });
    if (item) {
      const cat = data.categories.find((c) => c.id === item.kind);
      return cat?.workspace ? { item, cat } : null;
    }
    return null;
  }, [data]);

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

  return (
    <>
      <header className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.focus.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.focus.lead}</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="w-full lg:flex-1 min-w-0 space-y-6">
          {/* ─── Timer card ─── */}
          <div className="chronos-card-elevated overflow-hidden">
            {/* Top band — active block info */}
            {(previewBlock || activeScheduled) && (
              <div className="flex items-center gap-3 border-b border-border/30 px-6 py-3 bg-muted/20">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: previewColor }}
                />
                <span className="text-sm text-primary font-medium truncate flex-1">
                  {previewBlock?.title ?? scheduleText.blockTitle(activeScheduled!.title, activeScheduled!.titleCustom)}
                </span>
                <span className="text-xs text-muted-foreground num shrink-0">
                  {(previewBlock ?? activeScheduled)!.start}–{(previewBlock ?? activeScheduled)!.end}
                </span>
                {previewBlock && (
                  <span className="text-[10px] uppercase tracking-wider text-secondary shrink-0">
                    {t.chronos.focus.inProgress}
                  </span>
                )}
                {!previewBlock && activeScheduled && (
                  <Button size="sm" className="h-7 shrink-0" onClick={() => {
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

            {/* Main timer area — hourglass + controls */}
            <div className="px-8 py-8 flex flex-col items-center gap-6">
              <HourglassSVG ratio={timer.target > 0 ? timer.seconds / timer.target : 1} />

              <div className="text-center">
                <div className="font-display text-5xl leading-none text-primary num tracking-tight">
                  {timer.mm}<span className="text-secondary opacity-70">:</span>{timer.ss}
                </div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-2">
                  {t.chronos.focus.sealed}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-center">
                {[25, 45, 60, 90].map((m) => (
                  <button
                    key={m}
                    onClick={() => { timer.start(m); setPreviewBlock(null); }}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all border ${
                      timer.target === m * 60
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border/50 text-muted-foreground hover:border-border hover:text-primary"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { timer.reset(); setPreviewBlock(null); }}
                  className="h-10 w-10 rounded-full border border-border/50 grid place-items-center text-muted-foreground hover:text-primary hover:border-border transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={timer.togglePause}
                  className="h-14 w-14 rounded-full bg-secondary text-primary-deep grid place-items-center shadow-md hover:opacity-90 transition-opacity"
                >
                  {timer.running
                    ? <Pause className="h-6 w-6" />
                    : <Play className="h-6 w-6 ml-0.5" />}
                </button>
                <div className="h-10 w-10" />
              </div>
            </div>
          </div>

          <div className="chronos-card p-4"><FocusCategoryPicker /></div>

          <div className="chronos-card p-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.recurringDepth}</div>
            <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.focus.recurringTitle}</h3>
            <table className="w-full mt-4 text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground"><tr className="border-b border-border"><th className="text-left py-2">{t.chronos.focus.tableDay}</th><th className="text-left">{t.chronos.focus.tableTitle}</th><th className="text-right">{t.chronos.focus.tableStart}</th><th className="text-right">{t.chronos.focus.tableEnd}</th><th className="text-right">{t.chronos.focus.tableDuration}</th></tr></thead>
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
                    <td className="text-right num">{r.start}</td><td className="text-right num">{r.end}</td>
                    <td className="text-right num text-secondary">{fmtDur(durationMin(r.start, r.end))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">
          {activeSession && (
            <>
              <button
                onClick={() => setSessionOpen(true)}
                className="chronos-card w-full text-left hover:bg-muted/30 transition-colors group"
              >
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Active Session
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
                      <span className="text-[10px] text-secondary uppercase tracking-wider">Live</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-secondary/10 grid place-items-center shrink-0">
                      <span className="text-base">⚡</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-primary truncate">{activeSession.cat.label}</div>
                      <BlockSessionBadge
                        structure={activeSession.cat.workspace!}
                        runtime={activeSession.item.workspace ?? {}}
                        tier="compact"
                      />
                    </div>
                  </div>
                  {(() => {
                    const { done, total } = calcProgress(activeSession.item.workspace ?? {}, activeSession.cat.workspace!);
                    if (total === 0) return null;
                    return (
                      <div className="space-y-1">
                        <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-secondary transition-all duration-300"
                            style={{ width: `${Math.round((done / total) * 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-muted-foreground/50 num">
                          <span>{done} done</span>
                          <span>{total - done} remaining</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </button>
              <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[min(85vh,calc(100dvh-2rem))] overflow-y-auto p-0">
                  <div className="sr-only">
                    <h2 id="session-dialog-title">Session — {activeSession.cat.label}</h2>
                  </div>
                  <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b border-border/30 bg-card">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Session</div>
                      <div className="text-base font-medium text-primary">{activeSession.cat.label}</div>
                    </div>
                    {timer.running && (
                      <div className="flex items-center gap-1.5 text-sm text-secondary num font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
                        {timer.mm}:{timer.ss}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <SessionView
                      structure={activeSession.cat.workspace!}
                      runtime={activeSession.item.workspace ?? {}}
                      onChange={(r) => {
                        const id = activeSession.item.sourceId ?? activeSession.item.id;
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
            </>
          )}
          <div className="chronos-card p-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.todaysDepth}</div>
            <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.focus.composed(todays.length)}</h3>
            {(activeScheduled || nextScheduled) && (
              <div className="mt-4 rounded-md border border-secondary/30 bg-secondary/5 p-3.5">
                <div className="text-[10px] uppercase tracking-[0.18em] text-secondary">{t.chronos.focus.scheduledFocus}</div>
                {activeScheduled ? (
                  <>
                    <div className="text-sm text-primary mt-1">{scheduleText.blockTitle(activeScheduled.title, activeScheduled.titleCustom)}</div>
                    <div className="text-[11px] text-muted-foreground num">{activeScheduled.start}–{activeScheduled.end}</div>
                  </>
                ) : nextScheduled ? (
                  <>
                    <div className="text-sm text-primary mt-1">{scheduleText.blockTitle(nextScheduled.title, nextScheduled.titleCustom)}</div>
                    <div className="text-[11px] text-muted-foreground num">{nextScheduled.start}–{nextScheduled.end}</div>
                  </>
                ) : null}
              </div>
            )}
            <ul className="mt-4 space-y-3">
              {todays.length === 0 && <li className="text-sm text-muted-foreground italic">{t.chronos.focus.noDeepToday}</li>}
              {todays.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center"><Brain className="h-4 w-4 text-secondary-soft" /></div>
                  <div className="flex-1 min-w-0"><div className="text-sm text-primary truncate">{scheduleText.blockTitle(s.title, s.titleCustom)}</div><div className="text-[11px] text-muted-foreground num">{s.start}–{s.end} · {fmtDur(durationMin(s.start, s.end))}</div></div>
                </li>
              ))}
            </ul>
            <div className="mt-5"><ComposeBlockDialog trigger={<Button variant="outline" className="w-full">{t.chronos.focus.addDeep}</Button>} defaultKind={focusIds[0] ?? "deep"} /></div>
          </div>
        </div>
      </div>
    </>
  );
}
