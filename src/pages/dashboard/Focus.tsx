import { useState, useMemo } from "react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { durationMin, timeToMinutes } from "@/lib/schedule/types";
import type { TreeNode } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Brain, Pause, Play, RotateCcw, Plus, Minus, Check, Clock, Flame, Sparkles } from "lucide-react";
import { FocusCategoryPicker, safeKindStyle } from "@/components/dashboard/widgets";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { useTimer } from "@/lib/timer/TimerContext";
import { SessionView } from "@/components/dashboard/SessionView";
import { calcProgress, getNextUndonePath, selectTemplate, resolveActiveTemplateName, toggleTracking } from "@/lib/schedule/workspace-engine";
import { useLearningProfile } from "@/lib/ai/learning/store";
import Hourglass3D from "@/components/chronos/Hourglass3D";

// Walks an active template tree to the node addressed by a tracking path.
function findNodeByPath(root: TreeNode | undefined, path: string[]): TreeNode | null {
  let nodes = root?.children ?? [];
  let node: TreeNode | undefined;
  for (const name of path) {
    node = nodes.find((n) => n.name === name);
    if (!node) return null;
    nodes = node.children ?? [];
  }
  return node ?? null;
}

function minToClock(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  const am = h < 12;
  const hh = ((h + 11) % 12) + 1;
  return `${hh}${m ? ":" + String(m).padStart(2, "0") : ""}${am ? "am" : "pm"}`;
}

function dayPartLabel(startMin: number): string {
  if (startMin < 12 * 60) return "mornings";
  if (startMin < 18 * 60) return "afternoons";
  return "evenings";
}

export default function Focus() {
  const { data, updateRoutine, updateCommitment } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const timer = useTimer();
  const { profile } = useLearningProfile();
  const focusIds = data.meta.focusCategoryIds ?? [];
  const [previewBlock, setPreviewBlock] = useState<{ title: string; start: string; end: string; kind: string } | null>(null);
  const [customMin, setCustomMin] = useState(25);

  const activeSession = useMemo(() => {
    const agenda = buildAgendaForDate(data, new Date());
    const item = agenda.find((a) => {
      const cat = data.categories.find((c) => c.id === a.kind);
      const ws = (a as Record<string, unknown>).workspace as Record<string, unknown> | undefined;
      return cat?.workspace && ws?._sessionStarted && !ws?._sessionEnded;
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

  const ratio = timer.target > 0 ? timer.seconds / timer.target : 1;
  const isIdle = timer.target === 0 || (!timer.running && timer.seconds >= timer.target && !activeSession);

  // ── Active session: live runtime, current set readout ──
  const activeItemId = activeSession ? ((activeSession.item as { sourceId?: string }).sourceId ?? activeSession.item.id) : "";
  const ws = activeSession?.cat.workspace;
  const liveRuntime = activeSession
    ? (activeSession.item.source === "routine"
        ? (data.routine.find((r) => r.id === activeItemId)?.workspace ?? {})
        : (data.commitments.find((c) => c.id === activeSession.item.id)?.workspace ?? {}))
    : {};
  const sessionProgress = activeSession && ws ? calcProgress(liveRuntime, ws) : { done: 0, total: 0 };
  const nextPath = activeSession && ws ? getNextUndonePath(ws, liveRuntime) : undefined;
  const currentSetLabel = nextPath?.[nextPath.length - 1];
  const currentExercise = nextPath && nextPath.length >= 2 ? nextPath[nextPath.length - 2] : undefined;
  const currentNode = activeSession && ws && nextPath
    ? findNodeByPath(selectTemplate(ws, resolveActiveTemplateName(liveRuntime)), nextPath)
    : null;
  const setFields = (currentNode?.fields ?? {}) as Record<string, unknown>;
  const setLevelFields = ws ? (ws.levels[ws.levels.length - 1]?.fields ?? []) : [];
  const instruction = setFields.instruction ? String(setFields.instruction) : "";
  const chipFields = setLevelFields.filter((f) => f.name !== "instruction" && setFields[f.name] !== undefined && setFields[f.name] !== "");
  const sessionPct = sessionProgress.total > 0 ? Math.round((sessionProgress.done / sessionProgress.total) * 100) : 0;

  function completeCurrentSet() {
    if (!activeSession || !nextPath) return;
    const next = toggleTracking(liveRuntime, nextPath.join("/"));
    if (activeSession.item.source === "routine") updateRoutine(activeItemId, { workspace: next });
    else updateCommitment(activeSession.item.id, { workspace: next });
  }

  // ── Focus signal (learning profile) ──
  const dow = new Date().getDay();
  const peak = (() => {
    const windows = profile.productivityWindows.filter((w) => w.dayOfWeek === dow && w.averageFocusScore > 0);
    if (windows.length === 0) return null;
    const best = windows.reduce((a, b) => (b.averageFocusScore > a.averageFocusScore ? b : a));
    return { label: dayPartLabel(best.startMin), inIt: nowMin >= best.startMin && nowMin < best.endMin };
  })();
  const focusMinToday = todays.reduce((s, b) => s + durationMin(b.start, b.end), 0);
  const avgFocus = profile.averageFocusMinutesPerDay;
  const focusInsight = (() => {
    const hit = Object.entries(profile.userPreferences ?? {}).find(([k, v]) => /focus|deep|work/i.test(`${k} ${v}`));
    if (hit) return hit[1];
    const fc = profile.categoryPreferences.filter((c) => focusIds.includes(c.categoryId) && c.totalSessions >= 3);
    if (fc.length) {
      const best = fc.reduce((a, b) => (b.completionRate > a.completionRate ? b : a));
      const cat = data.categories.find((c) => c.id === best.categoryId);
      return `You complete ${cat?.label ?? best.categoryId} about ${Math.round(best.completionRate * 100)}% of the time, usually around ${minToClock(best.preferredStartMin)}.`;
    }
    return null;
  })();

  const heroTitle = previewBlock?.title ?? (activeScheduled ? scheduleText.blockTitle(activeScheduled.title, activeScheduled.titleCustom) : null);

  return (
    <>
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.eyebrow}</div>
          <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.focus.title}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.focus.lead}</p>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── LEFT: the vessel ────────────────────────────────────────────── */}
        <div className="w-full lg:flex-1 min-w-0 space-y-5">
          <div className="chronos-card-elevated overflow-hidden">

            {(previewBlock || activeScheduled) && (
              <div className="flex items-center gap-3 border-b border-border/20 px-6 py-3 bg-muted/25">
                <span className="h-2 w-2 rounded-full shrink-0 bg-secondary" />
                <span className="text-sm text-primary font-medium truncate flex-1">{heroTitle}</span>
                <span className="text-xs text-muted-foreground num shrink-0">
                  {(previewBlock ?? activeScheduled)!.start}–{(previewBlock ?? activeScheduled)!.end}
                </span>
                {!previewBlock && activeScheduled && (
                  <Button size="sm" className="h-7 shrink-0 text-xs" onClick={() => {
                    const mins = Math.max(15, durationMin(activeScheduled.start, activeScheduled.end));
                    timer.startScheduled(mins, { title: activeScheduled.title, start: activeScheduled.start, end: activeScheduled.end, kind: activeScheduled.kind });
                    setPreviewBlock({ title: activeScheduled.title, start: activeScheduled.start, end: activeScheduled.end, kind: activeScheduled.kind });
                  }}>
                    {t.chronos.focus.startWhenBegins}
                  </Button>
                )}
              </div>
            )}

            {/* 3D hourglass — sand level mirrors the timer */}
            <div className="h-56 sm:h-64 w-full">
              <Hourglass3D progress={ratio} running={timer.running} quiet />
            </div>

            <div className="px-6 sm:px-8 pb-6 -mt-3 flex flex-col items-center gap-5">
              <div className="text-center space-y-1">
                <div className="font-display text-6xl leading-none text-primary num tracking-tight tabular-nums">
                  {timer.mm}<span className="text-secondary/70 mx-0.5">:</span>{timer.ss}
                </div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-secondary/80">
                  {timer.running ? "Running" : isIdle ? "Ready" : "Paused"}
                </div>
              </div>

              {/* Context-aware readout: live set when a session runs, else block context */}
              {activeSession ? (
                <div className="w-full rounded-xl border border-secondary/25 bg-secondary/5 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-primary truncate">{currentExercise ?? activeSession.cat.label}</span>
                    <span className="text-xs text-muted-foreground num shrink-0">
                      {currentSetLabel ? `${currentSetLabel} · ` : ""}{sessionProgress.done}/{sessionProgress.total}
                    </span>
                  </div>
                  {(instruction || chipFields.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {instruction && <span className="text-[11px] rounded-md bg-card px-2 py-0.5 text-primary/80 border border-border/30">{instruction}</span>}
                      {chipFields.map((f) => (
                        <span key={f.name} className="text-[11px] rounded-md bg-card px-2 py-0.5 text-muted-foreground border border-border/30 num">
                          {f.label}: {String(setFields[f.name])}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2.5 h-1 rounded-full bg-muted/40 overflow-hidden">
                    <div className="h-full rounded-full bg-secondary transition-all duration-500" style={{ width: `${sessionPct}%` }} />
                  </div>
                </div>
              ) : (
                <div className="w-full text-center text-sm text-muted-foreground">
                  {activeScheduled
                    ? `Sealing focus on ${heroTitle}`
                    : nextScheduled
                    ? `Next focus · ${scheduleText.blockTitle(nextScheduled.title, nextScheduled.titleCustom)} at ${nextScheduled.start}`
                    : "Set a duration and seal a focus block."}
                </div>
              )}

              {/* Duration: free input + ±5 stepper */}
              <div className="flex items-center gap-2 w-full max-w-[260px]">
                <button onClick={() => setCustomMin((m) => Math.max(1, m - 5))} className="h-9 w-9 rounded-full border border-border/50 grid place-items-center text-muted-foreground hover:text-primary hover:border-border transition-colors shrink-0">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="number" min={1} max={480} value={customMin}
                    onChange={(e) => setCustomMin(Math.max(1, Math.min(480, parseInt(e.target.value) || 1)))}
                    className="w-full h-9 rounded-lg border border-border/50 bg-muted/20 text-center font-display text-lg text-primary num outline-none focus:border-primary/40 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/50 pointer-events-none">min</span>
                </div>
                <button onClick={() => setCustomMin((m) => Math.min(480, m + 5))} className="h-9 w-9 rounded-full border border-border/50 grid place-items-center text-muted-foreground hover:text-primary hover:border-border transition-colors shrink-0">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {[5, 15, 25, 45, 60, 90].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setCustomMin(m); timer.start(m); setPreviewBlock(null); }}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                      timer.target === m * 60 && (timer.running || timer.seconds < timer.target)
                        ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                        : "border-border/45 text-muted-foreground hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>

              {/* Controls: reset · play/pause · complete-set */}
              <div className="flex items-center gap-4">
                <button onClick={() => { timer.reset(); setPreviewBlock(null); }} className="h-10 w-10 rounded-full border border-border/50 grid place-items-center text-muted-foreground hover:text-primary hover:border-border/80 transition-colors" title="Reset">
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (isIdle || timer.seconds >= timer.target || timer.seconds <= 0) {
                      timer.start(customMin);
                      setPreviewBlock(null);
                    } else {
                      timer.togglePause();
                    }
                  }}
                  className="h-16 w-16 rounded-full bg-secondary text-primary-deep grid place-items-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
                >
                  {timer.running ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
                </button>
                {activeSession && nextPath ? (
                  <button onClick={completeCurrentSet} className="h-10 w-10 rounded-full border border-secondary/40 grid place-items-center text-secondary hover:bg-secondary/10 transition-colors" title="Complete current set">
                    <Check className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="h-10 w-10" />
                )}
              </div>
            </div>

            {/* Inline session detail */}
            {activeSession && ws && (
              <div className="border-t border-border/20 bg-muted/10 px-4 py-4">
                <SessionView
                  structure={ws}
                  runtime={liveRuntime}
                  onChange={(r) => {
                    if (activeSession.item.source === "routine") updateRoutine(activeItemId, { workspace: r });
                    else updateCommitment(activeSession.item.id, { workspace: r });
                  }}
                  onClose={() => {}}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: focus signal + deck ──────────────────────────────────── */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">

          {/* Focus signal */}
          <div className="chronos-card p-6 space-y-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-secondary">Focus signal</div>

            {peak && (
              <div className="flex gap-3">
                <Clock className="h-[18px] w-[18px] text-secondary mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm text-primary capitalize">Peak focus · {peak.label}</div>
                  {peak.inIt && <div className="mt-1"><span className="text-[11px] rounded-md bg-secondary/15 text-secondary px-2 py-0.5">You're in it</span></div>}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Flame className="h-[18px] w-[18px] text-muted-foreground/70 mt-0.5 shrink-0" />
              <div>
                <div className="text-sm text-primary">{fmtDur(focusMinToday)} of focus today</div>
                {avgFocus > 0 && <div className="text-xs text-muted-foreground mt-0.5">{Math.round((focusMinToday / avgFocus) * 100)}% of your daily average</div>}
              </div>
            </div>

            <div className="flex gap-3 border-t border-border/30 pt-3">
              <Sparkles className="h-[18px] w-[18px] text-secondary mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-secondary mb-1">Aetheris</div>
                {focusInsight
                  ? <p className="text-[13px] text-muted-foreground leading-relaxed">{focusInsight}</p>
                  : <p className="text-[13px] text-muted-foreground/70 leading-relaxed">Complete a few focus sessions and Aetheris will surface your peak windows here.</p>}
              </div>
            </div>
          </div>

          {/* Focus deck */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-[0.18em] text-secondary">Today's focus deck</div>
              <span className="text-xs text-muted-foreground/70 num">{todays.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {todays.map((b) => {
                const cat = data.categories.find((c) => c.id === b.kind);
                const dws = cat?.workspace;
                const rt = (b as Record<string, unknown>).workspace as Record<string, unknown> | undefined;
                const prog = dws && rt?.templateName ? calcProgress(rt, dws) : null;
                const isNow = activeScheduled?.id === b.id;
                const st = safeKindStyle(b.kind, data.categories);
                return (
                  <div key={b.id} className={`rounded-lg p-3 bg-card transition-colors ${isNow ? "border-2 border-secondary" : "border border-border/40"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground num">{b.start}–{b.end}</span>
                      {isNow && <span className="text-[10px] rounded-md bg-secondary/15 text-secondary px-1.5 py-0.5">Now</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${st.dot}`} style={st.dotStyle} />
                      <span className="text-sm font-medium text-primary truncate">{scheduleText.blockTitle(b.title, b.titleCustom)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground/70 mt-1 truncate">
                      {prog ? `${rt!.templateName as string} · ${prog.done}/${prog.total}` : (cat?.label ?? fmtDur(durationMin(b.start, b.end)))}
                    </div>
                  </div>
                );
              })}
              <ComposeBlockDialog
                trigger={
                  <button className="rounded-lg border border-dashed border-border/50 p-3 text-sm text-muted-foreground hover:text-secondary hover:border-secondary/40 transition-colors grid place-items-center min-h-[76px]">
                    <span className="flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add focus block</span>
                  </button>
                }
                defaultKind={focusIds[0] ?? "deep"}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Recurring focus (demoted) ───────────────────────────────────── */}
      <div className="chronos-card p-6 mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-muted-foreground/60" />
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.focus.recurringTitle}</div>
          <span className="text-xs text-muted-foreground/50 num ml-auto">{upcoming.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
            <tr className="border-b border-border/60">
              <th className="text-left py-2 font-normal">{t.chronos.focus.tableDay}</th>
              <th className="text-left font-normal">{t.chronos.focus.tableTitle}</th>
              <th className="text-right font-normal">{t.chronos.focus.tableStart}</th>
              <th className="text-right font-normal">{t.chronos.focus.tableEnd}</th>
              <th className="text-right font-normal">{t.chronos.focus.tableDuration}</th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((r) => {
              const kStyle = safeKindStyle(r.kind, data.categories);
              return (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="py-2.5 text-muted-foreground">{t.common.days.short[r.day]}</td>
                  <td className="text-primary py-2.5">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${kStyle.dot}`} style={kStyle.dotStyle} />
                      {scheduleText.blockTitle(r.title, r.titleCustom)}
                    </span>
                  </td>
                  <td className="text-right num">{r.start}</td>
                  <td className="text-right num">{r.end}</td>
                  <td className="text-right num text-secondary">{fmtDur(durationMin(r.start, r.end))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
