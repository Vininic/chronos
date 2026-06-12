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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
          <div className="chronos-card-elevated p-6 flex flex-col items-center gap-5">
            <div className="text-center flex flex-col items-center gap-4">
              {/* Hourglass SVG */}
              <svg viewBox="0 0 80 100" className="w-20 h-24 text-secondary">
                <defs>
                  <clipPath id="upperClip">
                    <path d="M16 10 L64 10 L48 38 Q40 44 40 44 Q40 44 32 38 Z" />
                  </clipPath>
                  <clipPath id="lowerClip">
                    <path d="M32 50 Q40 44 40 44 Q40 44 48 50 L64 90 L16 90 Z" />
                  </clipPath>
                </defs>
                {(() => {
                  const ratio = timer.target > 0 ? timer.seconds / timer.target : 1;
                  const upperH = 34;
                  const lowerH = 40;
                  return (
                    <>
                      {/* Upper bulb outline */}
                      <path d="M16 10 L64 10 L48 38 Q40 44 40 44 Q40 44 32 38 Z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
                      {/* Lower bulb outline */}
                      <path d="M32 50 Q40 44 40 44 Q40 44 48 50 L64 90 L16 90 Z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
                      {/* Neck */}
                      <rect x="38" y="42" width="4" height="8" rx="1" fill="currentColor" opacity="0.12" />
                      {/* Upper sand (remaining time) */}
                      <rect x="10" y="10" width="60" height={upperH * ratio} fill="currentColor" opacity="0.4" clipPath="url(#upperClip)" />
                      {/* Lower sand (elapsed time) */}
                      <rect x="10" y={90 - lowerH * (1 - ratio)} width="60" height={lowerH * (1 - ratio)} fill="currentColor" opacity="0.7" clipPath="url(#lowerClip)" />
                    </>
                  );
                })()}
              </svg>
              <div className="font-display text-2xl leading-none text-primary num">{timer.mm}<span className="text-secondary">:</span>{timer.ss}</div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground -mt-1">{t.chronos.focus.sealed}</div>
            </div>

            {previewBlock ? (
              <div className="w-full max-w-xs flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-4 py-3">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: previewColor }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-primary font-medium truncate">{previewBlock.title}</div>
                  <div className="text-[11px] text-muted-foreground num">{previewBlock.start}–{previewBlock.end}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-secondary shrink-0">{t.chronos.focus.inProgress}</span>
              </div>
            ) : activeScheduled ? (
              <div className="w-full max-w-xs flex items-center gap-3 rounded-lg border border-dashed border-secondary/40 px-4 py-3">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: TAILWIND_TO_HEX[kindStyle[activeScheduled.kind as BlockKind]?.dot ?? "bg-primary"] ?? "hsl(var(--primary))" }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-primary truncate">{scheduleText.blockTitle(activeScheduled.title, activeScheduled.titleCustom)}</div>
                  <div className="text-[11px] text-muted-foreground num">{activeScheduled.start}–{activeScheduled.end}</div>
                </div>
                <Button size="sm" className="h-8 shrink-0" onClick={() => {
                  const mins = Math.max(15, durationMin(activeScheduled.start, activeScheduled.end));
                  timer.startScheduled(mins, { title: activeScheduled.title, start: activeScheduled.start, end: activeScheduled.end, kind: activeScheduled.kind });
                  setPreviewBlock({ title: activeScheduled.title, start: activeScheduled.start, end: activeScheduled.end, kind: activeScheduled.kind });
                  toast({ title: t.chronos.focus.focusBlockStarted, description: `${scheduleText.blockTitle(activeScheduled.title)} · ${activeScheduled.start}–${activeScheduled.end}` });
                }}>
                  {t.chronos.focus.startWhenBegins}
                </Button>
              </div>
            ) : null}

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {[25, 45, 60, 90].map((m) => (
                <Button key={m} variant={timer.target === m * 60 ? "default" : "outline"} onClick={() => { timer.start(m); setPreviewBlock(null); }} className={timer.target === m * 60 ? "bg-primary text-primary-foreground" : ""}>{m}m</Button>
              ))}
              <Button onClick={timer.togglePause} className="bg-bronze text-primary-deep hover:opacity-90">{timer.running ? <><Pause className="h-4 w-4 mr-1" /> {t.chronos.focus.pause}</> : <><Play className="h-4 w-4 mr-1" /> {t.chronos.focus.begin}</>}</Button>
              <Button variant="outline" onClick={() => { timer.reset(); setPreviewBlock(null); }}><RotateCcw className="h-4 w-4 mr-1" /> {t.chronos.focus.reset}</Button>
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
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
          {activeSession && (
            <>
              <button
                onClick={() => setSessionOpen(true)}
                className="chronos-card p-4 w-full text-left hover:bg-sidebar-accent/30 transition-colors"
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">{t.chronos.focus.activeSession}</div>
                <div className="flex items-center gap-2.5">
                  <span className="relative h-2.5 w-2.5 shrink-0">
                    <span className="absolute inset-0 rounded-full bg-green-500 animate-pulse" />
                    <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
                  </span>
                  <span className="text-sm font-medium text-primary truncate">{activeSession.cat.label}</span>
                </div>
                <BlockSessionBadge structure={activeSession.cat.workspace!} runtime={activeSession.item.workspace ?? {}} tier="compact" />
              </button>
              <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
                <DialogContent className="max-w-lg overflow-y-auto max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>{activeSession.cat.label}</DialogTitle>
                  </DialogHeader>
                  {activeSession.cat.workspace && (
                    <SessionView
                      structure={activeSession.cat.workspace}
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
                  )}
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
