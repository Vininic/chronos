import { Sparkles, ArrowUpRight, Check, Clock, Coffee, Zap, Brain, Calendar as CalIcon } from "lucide-react";

/* ---------------- Daily agenda ---------------- */
const agenda = [
  { time: "06:30", end: "07:15", title: "Stoic morning · journaling", kind: "ritual", duration: 45 },
  { time: "08:00", end: "10:00", title: "Atlas block · Q3 strategy memo", kind: "deep", duration: 120 },
  { time: "10:15", end: "10:45", title: "Standup · Aurora team", kind: "meeting", duration: 30 },
  { time: "11:00", end: "12:30", title: "Investor brief · Meridian", kind: "meeting", duration: 90 },
  { time: "14:00", end: "15:30", title: "Atlas block · architectural review", kind: "deep", duration: 90 },
  { time: "16:00", end: "16:30", title: "Recovery · walk", kind: "recovery", duration: 30 },
  { time: "17:00", end: "18:00", title: "Correspondence", kind: "shallow", duration: 60 },
];

const kindStyle: Record<string, { dot: string; chip: string; label: string; icon: any }> = {
  deep: { dot: "bg-secondary", chip: "bg-secondary/15 text-secondary", label: "Deep", icon: Brain },
  meeting: { dot: "bg-primary", chip: "bg-primary/10 text-primary", label: "Meeting", icon: CalIcon },
  ritual: { dot: "bg-primary-glow", chip: "bg-primary/10 text-primary-glow", label: "Ritual", icon: Zap },
  recovery: { dot: "bg-emerald-700", chip: "bg-emerald-700/10 text-emerald-800", label: "Recovery", icon: Coffee },
  shallow: { dot: "bg-neutral-veil", chip: "bg-muted text-muted-foreground", label: "Shallow", icon: Clock },
};

export function DailyAgenda() {
  return (
    <div className="chronos-card p-6 lg:col-span-2">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Daily agenda</div>
          <h3 className="font-display text-2xl text-primary mt-1">The shape of today</h3>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="num">7 movements</span> · <span className="num">8h 25m</span> composed
        </div>
      </div>

      <div className="mt-6 relative">
        <div className="absolute left-[68px] top-1 bottom-1 w-px bg-border" />
        <ul className="space-y-3">
          {agenda.map((a) => {
            const s = kindStyle[a.kind];
            const Icon = s.icon;
            const now = a.time === "10:15";
            return (
              <li key={a.time} className="flex items-start gap-4">
                <div className="w-[60px] pt-2 text-right num text-xs text-muted-foreground tabular-nums">
                  {a.time}
                  <div className="text-[10px] text-muted-foreground/70">{a.end}</div>
                </div>
                <div className="relative pt-2.5">
                  <span className={`block h-2.5 w-2.5 rounded-full ${s.dot} ${now ? "ring-4 ring-secondary/30" : ""}`} />
                </div>
                <div className={`flex-1 rounded-lg border ${now ? "border-secondary/40 bg-secondary/5" : "border-border bg-surface-raised"} p-3.5 flex items-center gap-3`}>
                  <div className={`h-8 w-8 rounded-md grid place-items-center ${s.chip}`}><Icon className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">{a.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded ${s.chip} font-medium uppercase tracking-wider text-[10px]`}>{s.label}</span>
                      <span className="ml-2 num">{a.duration} min</span>
                      {now && <span className="ml-2 text-secondary font-medium">· in progress</span>}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- Productivity score ---------------- */
export function PerformanceCard() {
  const score = 86;
  const r = 56;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="chronos-card p-6">
      <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Performance index</div>
      <h3 className="font-display text-2xl text-primary mt-1">Composition score</h3>

      <div className="mt-6 grid place-items-center relative">
        <svg width="180" height="180" viewBox="0 0 140 140">
          <defs>
            <linearGradient id="bronzeArc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D8B06A" />
              <stop offset="100%" stopColor="#B7863B" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke="url(#bronzeArc)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-display text-5xl text-primary num">{score}</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-1">of 100 · this week</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { l: "Depth", v: 92 },
          { l: "Cadence", v: 81 },
          { l: "Recovery", v: 74 },
        ].map((m) => (
          <div key={m.l} className="rounded-md bg-surface-raised border border-border p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{m.l}</div>
            <div className="font-display text-xl text-primary mt-0.5 num">{m.v}</div>
            <div className="h-1 mt-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-bronze" style={{ width: `${m.v}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- AI suggestions ---------------- */
const suggestions = [
  { t: "Consolidate three Wednesday gaps", d: "Merge into a 90-minute Atlas block at 14:00 to recover deep-work density.", impact: "+38m depth", priority: "high" },
  { t: "Defer Friday review by one cycle", d: "Quarter velocity allows a 7-day shift. Reclaim Friday morning.", impact: "+1 morning", priority: "med" },
  { t: "Insert recovery after Meridian brief", d: "Cortisol load forecast suggests a 20-minute walk window.", impact: "Balance ↑", priority: "low" },
];

export function AetherisCard() {
  return (
    <div className="chronos-card-elevated p-6 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-secondary/10 blur-2xl" />
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-bronze grid place-items-center shadow-bronze">
            <Sparkles className="h-4 w-4 text-primary-deep" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Aetheris AI</div>
            <h3 className="font-display text-xl text-primary -mt-0.5">Quiet suggestions</h3>
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">3 awaiting review</span>
      </div>

      <ul className="mt-5 space-y-3 relative">
        {suggestions.map((s) => (
          <li key={s.t} className="rounded-lg border border-border bg-surface-raised p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-primary">{s.t}</div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.d}</p>
              </div>
              <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded ${
                s.priority === "high" ? "bg-secondary text-primary-deep" :
                s.priority === "med" ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"
              }`}>{s.impact}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button className="text-xs h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary-deep inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" /> Apply
              </button>
              <button className="text-xs h-8 px-3 rounded-md border border-border hover:bg-secondary/10 text-muted-foreground">Defer</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Weekly routine planner ---------------- */
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = [7, 9, 11, 13, 15, 17, 19];
type Block = { day: number; start: number; span: number; kind: keyof typeof kindStyle; label: string };
const weekBlocks: Block[] = [
  { day: 0, start: 8, span: 2, kind: "deep", label: "Atlas" },
  { day: 0, start: 11, span: 1, kind: "meeting", label: "Aurora" },
  { day: 0, start: 14, span: 1.5, kind: "deep", label: "Review" },
  { day: 1, start: 7, span: 1, kind: "ritual", label: "Stoic" },
  { day: 1, start: 9, span: 2, kind: "deep", label: "Memo" },
  { day: 1, start: 13, span: 1, kind: "meeting", label: "1:1" },
  { day: 1, start: 16, span: 1, kind: "recovery", label: "Walk" },
  { day: 2, start: 8, span: 1.5, kind: "deep", label: "Atlas" },
  { day: 2, start: 11, span: 1, kind: "meeting", label: "Brief" },
  { day: 2, start: 14, span: 1.5, kind: "deep", label: "Suggested", },
  { day: 3, start: 9, span: 2, kind: "deep", label: "Strategy" },
  { day: 3, start: 13, span: 1.5, kind: "meeting", label: "Board" },
  { day: 4, start: 8, span: 1, kind: "ritual", label: "Stoic" },
  { day: 4, start: 10, span: 2, kind: "deep", label: "Atlas" },
  { day: 4, start: 15, span: 1.5, kind: "shallow", label: "Email" },
  { day: 5, start: 9, span: 1.5, kind: "recovery", label: "Long walk" },
  { day: 6, start: 10, span: 1, kind: "ritual", label: "Reflect" },
];

export function WeeklyRoutine() {
  const startHour = 7;
  const endHour = 19;
  const totalHours = endHour - startHour;
  const rowHeight = 36; // px per hour
  const gridHeight = totalHours * rowHeight;
  const tickHours = [7, 9, 11, 13, 15, 17, 19];
  return (
    <div className="chronos-card p-6 lg:col-span-3">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Routine composer</div>
          <h3 className="font-display text-2xl text-primary mt-1">The shape of the week</h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {(Object.keys(kindStyle) as Array<keyof typeof kindStyle>).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${kindStyle[k].dot}`} />
              <span className="text-muted-foreground capitalize">{kindStyle[k].label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[56px_repeat(7,1fr)] gap-2">
        <div />
        {days.map((d) => (
          <div key={d} className="text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground pb-2">
            {d}
          </div>
        ))}

        {/* hour ticks column */}
        <div className="relative" style={{ height: gridHeight }}>
          {tickHours.map((h) => (
            <div
              key={h}
              className="absolute right-2 -translate-y-1/2 text-[10px] num text-muted-foreground/70"
              style={{ top: ((h - startHour) / totalHours) * gridHeight }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((_, di) => (
          <div
            key={`col-${di}`}
            className="relative rounded-md bg-surface-raised border border-border/60"
            style={{ height: gridHeight }}
          >
            {/* hour gridlines */}
            {tickHours.slice(1, -1).map((h) => (
              <div
                key={`gl-${h}`}
                className="absolute left-0 right-0 border-t border-dashed border-border/50"
                style={{ top: ((h - startHour) / totalHours) * gridHeight }}
              />
            ))}
            {weekBlocks
              .filter((b) => b.day === di)
              .map((b, idx) => {
                const s = kindStyle[b.kind];
                const top = ((b.start - startHour) / totalHours) * gridHeight;
                const height = (b.span / totalHours) * gridHeight - 2;
                return (
                  <div
                    key={idx}
                    className={`absolute left-1 right-1 rounded-md text-[10px] font-medium px-1.5 py-1 ${s.chip} border border-current/10 overflow-hidden`}
                    style={{ top, height }}
                    title={b.label}
                  >
                    {b.label}
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
  const sessions = [
    { t: "Atlas · Strategy memo", d: "120m", q: 96 },
    { t: "Architectural review", d: "90m", q: 88 },
    { t: "Quarter forecast", d: "75m", q: 71 },
  ];
  return (
    <div className="chronos-card p-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Focus blocks</div>
          <h3 className="font-display text-2xl text-primary mt-1">Today's depth</h3>
        </div>
        <span className="text-xs text-muted-foreground num">3 sealed · 6h 42m</span>
      </div>
      <ul className="mt-5 space-y-3">
        {sessions.map((s) => (
          <li key={s.t} className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Brain className="h-4 w-4 text-secondary-soft" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-primary truncate">{s.t}</div>
              <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-bronze" style={{ width: `${s.q}%` }} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground num">{s.d}</div>
              <div className="text-[11px] text-secondary num">{s.q}%</div>
            </div>
          </li>
        ))}
      </ul>
      <button className="mt-5 w-full h-10 rounded-md bg-midnight text-primary-foreground text-sm hover:opacity-95 inline-flex items-center justify-center gap-2">
        Begin a session <ArrowUpRight className="h-4 w-4 text-secondary-soft" />
      </button>
    </div>
  );
}

/* ---------------- Deep work / recovery balance ---------------- */
export function BalanceCard() {
  // sparkline of deep vs recovery hours over 14 days
  const deep =     [4.2, 5.1, 6.0, 5.5, 7.1, 6.8, 5.0, 6.4, 7.0, 6.2, 7.4, 6.9, 7.2, 6.8];
  const recovery =[1.5, 1.2, 1.6, 1.8, 1.3, 2.0, 2.4, 1.8, 1.7, 2.1, 1.9, 2.2, 2.0, 2.3];
  const max = Math.max(...deep);
  const W = 320, H = 120, P = 8;
  const x = (i: number) => P + (i / (deep.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const path = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  return (
    <div className="chronos-card p-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Equilibrium</div>
        <h3 className="font-display text-2xl text-primary mt-1">Deep work · Recovery</h3>
      </div>
      <div className="mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
          <defs>
            <linearGradient id="deepFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${path(deep)} L ${x(deep.length - 1)} ${H - P} L ${x(0)} ${H - P} Z`} fill="url(#deepFill)" />
          <path d={path(deep)} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
          <path d={path(recovery)} fill="none" stroke="hsl(var(--secondary))" strokeWidth="2" strokeDasharray="3 3" />
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-surface-raised border p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" /> Deep
          </div>
          <div className="font-display text-xl text-primary mt-0.5 num">6.4h <span className="text-xs text-muted-foreground font-sans">avg</span></div>
        </div>
        <div className="rounded-md bg-surface-raised border p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-secondary" /> Recovery
          </div>
          <div className="font-display text-xl text-primary mt-0.5 num">1.9h <span className="text-xs text-muted-foreground font-sans">avg</span></div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Schedule optimization cards ---------------- */
export function OptimizationStrip() {
  const cards = [
    { k: "Reclaim mornings", v: "+4h 12m", d: "Shift 3 standups to async briefs.", trend: "weekly" },
    { k: "Compress meetings", v: "−27%", d: "Default 45m → 30m for recurring.", trend: "this cycle" },
    { k: "Recovery debt", v: "1h 20m", d: "Insert two 40m walks before Friday.", trend: "outstanding" },
    { k: "Cadence drift", v: "Stable", d: "Routine adherence at 91%.", trend: "14-day" },
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
