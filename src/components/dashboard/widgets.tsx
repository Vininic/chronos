import { Sparkles, ArrowUpRight, Check, Clock, Coffee, Zap, Brain, Calendar as CalIcon, X } from "lucide-react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { BlockKind, durationMin, timeToMinutes } from "@/lib/schedule/types";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { ComposeBlockDialog } from "./ComposeBlockDialog";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";

export const kindStyle: Record<BlockKind, { dot: string; chip: string; icon: any }> = {
  deep:     { dot: "bg-secondary",       chip: "bg-secondary/15 text-secondary",         icon: Brain },
  meeting:  { dot: "bg-primary",         chip: "bg-primary/10 text-primary",             icon: CalIcon },
  ritual:   { dot: "bg-primary-glow",    chip: "bg-primary/10 text-primary-glow",        icon: Zap },
  recovery: { dot: "bg-emerald-700",     chip: "bg-emerald-700/10 text-emerald-800",     icon: Coffee },
  shallow:  { dot: "bg-neutral-veil",    chip: "bg-muted text-muted-foreground",         icon: Clock },
};

/* ---------------- Daily agenda (data-driven) ---------------- */
export function DailyAgenda() {
  const { data } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const today = new Date();
  const agenda = buildAgendaForDate(data, today);
  const totalMin = agenda.reduce((sum, a) => sum + durationMin(a.start, a.end), 0);
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const liveId = agenda.find((a) => timeToMinutes(a.start) <= nowMin && nowMin < timeToMinutes(a.end))?.id;

  return (
    <div className="chronos-card p-6 h-full">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.dailyAgenda}</div>
          <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.dailyTitle}</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="num">{t.chronos.widgets.movements(agenda.length)}</span> · <span className="num">{fmtDur(totalMin)}</span> {t.chronos.widgets.composed}
        </div>
      </div>

      {agenda.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t.chronos.widgets.emptyAgenda} <ComposeBlockDialog trigger={<button className="text-secondary hover:underline ml-1">{t.chronos.widgets.composeOne}</button>} />
        </div>
      ) : (
        <div className="mt-6 relative">
          <div className="absolute left-[68px] top-1 bottom-1 w-px bg-border" />
          <ul className="space-y-3">
            {agenda.map((a) => {
              const s = kindStyle[a.kind];
              const Icon = s.icon;
              const live = a.id === liveId;
              return (
                <li key={a.id} className="flex items-start gap-4">
                  <div className="w-[60px] pt-2 text-right num text-xs text-muted-foreground tabular-nums">
                    {a.start}
                    <div className="text-[10px] text-muted-foreground/70">{a.end}</div>
                  </div>
                  <div className="relative pt-2.5">
                    <span className={`block h-2.5 w-2.5 rounded-full ${s.dot} ${live ? "ring-4 ring-secondary/30" : ""}`} />
                  </div>
                  <div className={`flex-1 rounded-lg border ${live ? "border-secondary/40 bg-secondary/5" : "border-border bg-surface-raised"} p-3.5 flex items-center gap-3`}>
                    <div className={`h-8 w-8 rounded-md grid place-items-center ${s.chip}`}><Icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">{a.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded ${s.chip} font-medium uppercase tracking-wider text-[10px]`}>{t.common.kinds[a.kind]}</span>
                        <span className="ml-2 num">{fmtDur(durationMin(a.start, a.end))}</span>
                        {live && <span className="ml-2 text-secondary font-medium">· {t.chronos.widgets.inProgress}</span>}
                        {a.source === "commitment" && <span className="ml-2 text-muted-foreground">· {t.chronos.widgets.commitmentTag}</span>}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------- Productivity score ---------------- */
export function PerformanceCard() {
  const { data } = useSchedule();
  const t = useT();
  const score = data.ledger.compositionScore;
  const r = 56;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="chronos-card p-6 h-full">
      <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.perfIndex}</div>
      <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.compositionScore}</h3>

      <div className="mt-6 grid place-items-center relative">
        <svg width="180" height="180" viewBox="0 0 140 140">
          <defs>
            <linearGradient id="bronzeArc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D8B06A" />
              <stop offset="100%" stopColor="#B7863B" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle cx="70" cy="70" r={r} fill="none" stroke="url(#bronzeArc)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 70 70)" />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-display text-5xl text-primary num">{score}</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-1">{t.chronos.widgets.ofThisWeek}</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {data.ledger.metrics.map((m) => (
          <div key={m.label} className="rounded-md bg-surface-raised border border-border p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{translateMetric(t, m.label)}</div>
            <div className="font-display text-xl text-primary mt-0.5 num">{m.value}</div>
            <div className="h-1 mt-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-bronze" style={{ width: `${m.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function translateMetric(t: ReturnType<typeof useT>, label: string): string {
  const map: Record<string, string> = {
    Depth:    t.chronos.widgets.deep,
    Cadence:  t.chronos.widgets.weekly,
    Recovery: t.chronos.widgets.recovery,
  };
  return map[label] ?? label;
}

/* ---------------- AI suggestions ---------------- */
export function AetherisCard() {
  const { data, applySuggestion, deferSuggestion } = useSchedule();
  const t = useT();
  return (
    <div className="chronos-card-elevated p-6 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-secondary/10 blur-2xl" />
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-bronze grid place-items-center shadow-bronze">
            <Sparkles className="h-4 w-4 text-primary-deep" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.nav.aetheris}</div>
            <h3 className="font-display text-xl text-primary -mt-0.5">{t.chronos.aetheris.quietSuggestions}</h3>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">{data.suggestions.length} {t.common.awaitingReview}</span>
      </div>

      {data.suggestions.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground italic">{t.chronos.aetheris.allQuietLead}</p>
      ) : (
        <ul className="mt-5 space-y-3 relative">
          {data.suggestions.map((s) => (
            <li key={s.id} className="rounded-lg border border-border bg-surface-raised p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary">{s.title}</div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.detail}</p>
                </div>
                <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded ${
                  s.priority === "high" ? "bg-secondary text-primary-deep" :
                  s.priority === "med"  ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"
                }`}>{s.impact}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => { applySuggestion(s.id); toast({ title: t.chronos.aetheris.applied, description: s.title }); }}
                  className="text-xs h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary-deep inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> {t.common.apply}
                </button>
                <button onClick={() => { deferSuggestion(s.id); toast({ title: t.chronos.aetheris.deferred, description: t.chronos.aetheris.deferredDesc }); }}
                  className="text-xs h-8 px-3 rounded-md border border-border hover:bg-secondary/10 text-muted-foreground inline-flex items-center gap-1.5">
                  <X className="h-3.5 w-3.5" /> {t.common.defer}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Weekly routine planner ---------------- */
export function WeeklyRoutine({ editable = false }: { editable?: boolean }) {
  const { data, removeRoutine } = useSchedule();
  const t = useT();
  const days = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
  const startHour = 7;
  const endHour = 19;
  const totalHours = endHour - startHour;
  const rowHeight = 36;
  const gridHeight = totalHours * rowHeight;
  const tickHours = [7, 9, 11, 13, 15, 17, 19];
  return (
    <div className="chronos-card p-6 lg:col-span-3">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.composer}</div>
          <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.weekShape}</h3>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {(Object.keys(kindStyle) as BlockKind[]).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${kindStyle[k].dot}`} />
              <span className="text-muted-foreground">{t.common.kinds[k]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[56px_repeat(7,1fr)] gap-2">
        <div />
        {days.map((di) => (
          <div key={di} className="text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground pb-2">
            {t.common.days.short[di]}
          </div>
        ))}
        <div className="relative" style={{ height: gridHeight }}>
          {tickHours.map((h) => (
            <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] num text-muted-foreground/70" style={{ top: ((h - startHour) / totalHours) * gridHeight }}>
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        {days.map((di) => (
          <div key={`col-${di}`} className="relative rounded-md bg-surface-raised border border-border/60" style={{ height: gridHeight }}>
            {tickHours.slice(1, -1).map((h) => (
              <div key={`gl-${h}`} className="absolute left-0 right-0 border-t border-dashed border-border/50" style={{ top: ((h - startHour) / totalHours) * gridHeight }} />
            ))}
            {data.routine.filter((b) => b.day === di).map((b) => {
              const sh = timeToMinutes(b.start) / 60;
              const eh = timeToMinutes(b.end) / 60;
              const top = ((sh - startHour) / totalHours) * gridHeight;
              const height = Math.max(18, ((eh - sh) / totalHours) * gridHeight - 2);
              const s = kindStyle[b.kind];
              return (
                <div key={b.id} className={`group absolute left-1 right-1 rounded-md text-[10px] font-medium px-1.5 py-1 ${s.chip} border border-current/10 overflow-hidden`} style={{ top, height }} title={`${b.title} · ${b.start}–${b.end}`}>
                  <div className="truncate">{b.title}</div>
                  <div className="text-[9px] opacity-70 num">{b.start}</div>
                  {editable && (
                    <button onClick={() => { removeRoutine(b.id); toast({ title: t.chronos.widgets.blockRemoved }); }} className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 h-4 w-4 rounded grid place-items-center bg-background/70 hover:bg-background">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Focus blocks card ---------------- */
export function FocusBlocksCard() {
  const { data } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const today = new Date();
  const todays = buildAgendaForDate(data, today).filter((a) => a.kind === "deep");
  const totalMin = todays.reduce((s, a) => s + durationMin(a.start, a.end), 0);

  return (
    <div className="chronos-card p-6 h-full flex flex-col">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.focus}</div>
          <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.focusToday}</h3>
        </div>
        <span className="text-xs text-muted-foreground num">{t.chronos.widgets.focusComposed(todays.length, fmtDur(totalMin))}</span>
      </div>
      {todays.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground italic">{t.chronos.widgets.focusEmpty}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {todays.map((s) => {
            const dur = durationMin(s.start, s.end);
            const pct = Math.min(100, Math.round((dur / 120) * 100));
            return (
              <li key={s.id} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
                  <Brain className="h-4 w-4 text-secondary-soft" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-primary truncate">{s.title}</div>
                  <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-bronze" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground num">{fmtDur(dur)}</div>
                  <div className="text-[11px] text-secondary num">{s.start}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex-1" />
      <Link to="/dashboard/focus" className="block">
        <button className="mt-5 w-full h-10 rounded-md bg-midnight text-primary-foreground text-sm hover:opacity-95 inline-flex items-center justify-center gap-2">
          {t.chronos.widgets.openFocusRoom} <ArrowUpRight className="h-4 w-4 text-secondary-soft" />
        </button>
      </Link>
    </div>
  );
}

/* ---------------- Deep / recovery balance ---------------- */
export function BalanceCard() {
  const { data } = useSchedule();
  const t = useT();
  const deep = data.ledger.deepHours;
  const recovery = data.ledger.recoveryHours;
  const max = Math.max(...deep, ...recovery);
  const W = 320, H = 120, P = 8;
  const x = (i: number) => P + (i / (deep.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const avg = (arr: number[]) => (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1);
  return (
    <div className="chronos-card p-6 h-full flex flex-col">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.equilibrium}</div>
          <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.balanceTitle}</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-primary" /> {t.chronos.widgets.deep}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-secondary" /> {t.chronos.widgets.recovery}</span>
        </div>
      </div>
      <div className="mt-5 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-36">
          <defs>
            <linearGradient id="deepFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.32" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="recoveryFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity="0.28" />
              <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* baseline ticks */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="2 4" />
          ))}
          <path d={`${path(recovery)} L ${x(recovery.length - 1)} ${H - P} L ${x(0)} ${H - P} Z`} fill="url(#recoveryFill)" />
          <path d={`${path(deep)} L ${x(deep.length - 1)} ${H - P} L ${x(0)} ${H - P} Z`} fill="url(#deepFill)" />
          <path d={path(deep)} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
          <path d={path(recovery)} fill="none" stroke="hsl(var(--secondary))" strokeWidth="2" strokeDasharray="4 3" />
          {/* end-point markers */}
          <circle cx={x(deep.length - 1)} cy={y(deep[deep.length - 1])} r="3" fill="hsl(var(--primary))" />
          <circle cx={x(recovery.length - 1)} cy={y(recovery[recovery.length - 1])} r="3" fill="hsl(var(--secondary))" />
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-surface-raised border p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" /> {t.chronos.widgets.deep}
          </div>
          <div className="font-display text-xl text-primary mt-0.5 num">{avg(deep)}h <span className="text-xs text-muted-foreground font-sans">{t.chronos.widgets.avg}</span></div>
        </div>
        <div className="rounded-md bg-surface-raised border p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-secondary" /> {t.chronos.widgets.recovery}
          </div>
          <div className="font-display text-xl text-primary mt-0.5 num">{avg(recovery)}h <span className="text-xs text-muted-foreground font-sans">{t.chronos.widgets.avg}</span></div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Schedule optimization cards ---------------- */
export function OptimizationStrip() {
  const { data } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const totalRoutineMin = data.routine.reduce((s, b) => s + durationMin(b.start, b.end), 0);
  const deepMin = data.routine.filter((r) => r.kind === "deep").reduce((s, b) => s + durationMin(b.start, b.end), 0);
  const meetingMin = data.routine.filter((r) => r.kind === "meeting").reduce((s, b) => s + durationMin(b.start, b.end), 0);
  const recoveryMin = data.routine.filter((r) => r.kind === "recovery").reduce((s, b) => s + durationMin(b.start, b.end), 0);
  const cards = [
    { k: t.chronos.widgets.composedWeekly, v: fmtDur(totalRoutineMin), d: t.chronos.widgets.composedWeeklyDesc(data.routine.length), trend: t.chronos.widgets.thisWeek },
    { k: t.chronos.widgets.deepRatio,      v: `${Math.round((deepMin / Math.max(1, totalRoutineMin)) * 100)}%`, d: t.chronos.widgets.deepRatioDesc, trend: t.chronos.widgets.deepRatioTrend },
    { k: t.chronos.widgets.meetingLoad,    v: fmtDur(meetingMin), d: t.chronos.widgets.meetingLoadDesc, trend: t.chronos.widgets.weekly },
    { k: t.chronos.widgets.recoveryDebt,   v: recoveryMin >= 120 ? t.chronos.widgets.recoveryDebtCleared : fmtDur(120 - recoveryMin), d: t.chronos.widgets.recoveryDebtDesc, trend: t.chronos.widgets.outstanding },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.k} className="chronos-card p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{c.k}</div>
          <div className="font-display text-3xl text-primary mt-1.5 num">{c.v}</div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{c.d}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-secondary">{c.trend}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
