import { Sparkles, ArrowUpRight, Check, Clock, Coffee, Zap, Brain, Calendar as CalIcon, X, Moon, Target, AlertTriangle } from "lucide-react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { BlockKind, RoutineBlock, durationMin, timeToMinutes } from "@/lib/schedule/types";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { ComposeBlockDialog } from "./ComposeBlockDialog";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { useState, useEffect } from "react";
import { subscribe as subscribeNotif, getAetherisCount } from "@/lib/notification-count";
import { getAllDigests, getLatestDigest } from "@/lib/digest/store";
import { DigestView } from "@/components/digest/DigestView";

type BlockStyle = { dot: string; chip: string; icon: React.ComponentType<{ className?: string }>; blockBg: string; blockBorder: string; customColor?: string; blockStyle?: React.CSSProperties; chipStyle?: React.CSSProperties; dotStyle?: React.CSSProperties };

function categoryLabel(
  data: ReturnType<typeof useSchedule>["data"],
  kind: BlockKind,
  fallback: ReturnType<typeof useT>,
  localizeCategoryLabel: (kind: BlockKind, label: string, customLabel?: string) => string,
) {
  const category = data.categories.find((c) => c.id === kind);
  return category ? localizeCategoryLabel(kind, category.label, category.labelCustom) : fallback.common.kinds[kind];
}

export const kindStyle: Record<string, BlockStyle> = {
  deep:     { dot: "bg-amber-500",   chip: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300",     icon: Brain,   blockBg: "bg-amber-500/10 dark:bg-amber-400/15",    blockBorder: "border-amber-500/35 dark:border-amber-400/30" },
  meeting:  { dot: "bg-blue-500",    chip: "bg-blue-500/15  text-blue-700  dark:bg-blue-400/20  dark:text-blue-300",      icon: CalIcon, blockBg: "bg-blue-500/10  dark:bg-blue-400/15",     blockBorder: "border-blue-500/30  dark:border-blue-400/25" },
  ritual:   { dot: "bg-violet-500",  chip: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300", icon: Zap,     blockBg: "bg-violet-500/10 dark:bg-violet-400/15", blockBorder: "border-violet-500/30 dark:border-violet-400/25" },
  recovery: { dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300", icon: Coffee, blockBg: "bg-emerald-500/10 dark:bg-emerald-400/15", blockBorder: "border-emerald-500/30 dark:border-emerald-400/25" },
  shallow:  { dot: "bg-slate-400",   chip: "bg-slate-400/15  text-slate-600  dark:bg-slate-400/20  dark:text-slate-300",  icon: Clock,   blockBg: "bg-slate-400/10",                         blockBorder: "border-slate-400/30" },
  sleep:    { dot: "bg-indigo-400",  chip: "bg-indigo-400/15  text-indigo-700 dark:bg-indigo-400/20  dark:text-indigo-300",  icon: Moon,    blockBg: "bg-indigo-400/10  dark:bg-indigo-400/12",  blockBorder: "border-indigo-400/30 dark:border-indigo-400/20" },
};

const toneStyle: Record<string, BlockStyle> = {
  bronze:       { dot: "bg-amber-600",   chip: "bg-amber-600/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",     icon: Brain,  blockBg: "bg-amber-600/10",                      blockBorder: "border-amber-600/35" },
  midnight:     { dot: "bg-indigo-600",  chip: "bg-indigo-600/15 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300",   icon: Moon,   blockBg: "bg-indigo-600/10",                     blockBorder: "border-indigo-600/35" },
  "primary-glow": { dot: "bg-violet-500", chip: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300", icon: Zap,    blockBg: "bg-violet-500/10 dark:bg-violet-400/15", blockBorder: "border-violet-500/35" },
  neutral:      { dot: "bg-slate-400",   chip: "bg-slate-400/15 text-slate-600 dark:bg-slate-400/20 dark:text-slate-300",       icon: Clock,  blockBg: "bg-slate-400/10",                     blockBorder: "border-slate-400/30" },
  sky:          { dot: "bg-sky-500",     chip: "bg-sky-500/15 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300",              icon: Brain,  blockBg: "bg-sky-500/10",                       blockBorder: "border-sky-500/35" },
  violet:       { dot: "bg-violet-500",  chip: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300",   icon: Brain,  blockBg: "bg-violet-500/10",                    blockBorder: "border-violet-500/35" },
  coral:        { dot: "bg-rose-500",    chip: "bg-rose-500/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300",            icon: Clock,  blockBg: "bg-rose-500/10",                      blockBorder: "border-rose-500/35" },
  mint:         { dot: "bg-emerald-400", chip: "bg-emerald-400/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300", icon: Coffee, blockBg: "bg-emerald-400/10",                  blockBorder: "border-emerald-400/35" },
  peach:        { dot: "bg-amber-400",   chip: "bg-amber-400/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300",       icon: Coffee, blockBg: "bg-amber-400/10",                    blockBorder: "border-amber-400/35" },
  amber:        { dot: "bg-amber-500",   chip: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300",        icon: Brain,  blockBg: "bg-amber-500/10",                    blockBorder: "border-amber-500/35" },
  slate:        { dot: "bg-slate-500",   chip: "bg-slate-500/15 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300",        icon: Clock,  blockBg: "bg-slate-500/10",                    blockBorder: "border-slate-500/35" },
  lime:         { dot: "bg-lime-500",    chip: "bg-lime-500/15 text-lime-700 dark:bg-lime-400/20 dark:text-lime-300",             icon: Zap,    blockBg: "bg-lime-500/10",                     blockBorder: "border-lime-500/35" },
  rose:         { dot: "bg-rose-400",    chip: "bg-rose-400/15 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300",            icon: Coffee, blockBg: "bg-rose-400/10",                     blockBorder: "border-rose-400/35" },
  emerald:      { dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300", icon: Brain,  blockBg: "bg-emerald-500/10",                  blockBorder: "border-emerald-500/35" },
  indigo:       { dot: "bg-indigo-500",  chip: "bg-indigo-500/15 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-300",    icon: Moon,   blockBg: "bg-indigo-500/10",                   blockBorder: "border-indigo-500/35" },
  chartreuse:   { dot: "bg-lime-500",    chip: "bg-lime-500/15 text-lime-700 dark:bg-lime-400/20 dark:text-lime-300",             icon: Zap,    blockBg: "bg-lime-500/10",                     blockBorder: "border-lime-500/35" },
};

const FALLBACK_STYLE: BlockStyle = { dot: "bg-muted-foreground", chip: "bg-muted/50 text-muted-foreground", icon: Clock, blockBg: "bg-muted/30", blockBorder: "border-border/50" };

export function toCssColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const t = color.trim();
  if (t.startsWith("#") || t.startsWith("rgb") || t.startsWith("hsl")) return t;
  if (/^\d+\s+\d+\s+\d+$/.test(t)) return `rgb(${t.replace(/\s+/g, ", ")})`;
  if (/^\d+,\s*\d+,\s*\d+$/.test(t)) return `rgb(${t})`;
  return t;
}

export function alpha(color: string, opacity: string): string {
  if (color.startsWith("#")) return color + opacity;
  if (color.startsWith("rgb(")) return color.replace("rgb(", "rgba(").replace(")", `, ${parseInt(opacity, 16) / 255})`);
  return color;
}

const DEFAULT_TONES = ["sky", "violet", "coral", "mint", "peach", "amber", "emerald", "indigo", "rose", "lime"];

function pickDefaultTone(kind: string): string {
  let hash = 0;
  for (let i = 0; i < kind.length; i++) hash = ((hash << 5) - hash) + kind.charCodeAt(i) | 0;
  return DEFAULT_TONES[Math.abs(hash) % DEFAULT_TONES.length];
}

export function safeKindStyle(kind: string, categories?: { id: string; tone?: string; color?: string }[]): BlockStyle {
  if (kindStyle[kind]) {
    if (categories) {
      const cat = categories.find(c => c.id === kind);
      const cssColor = toCssColor(cat?.color);
      if (cssColor) return { ...kindStyle[kind], customColor: cssColor, blockStyle: { backgroundColor: alpha(cssColor, "18"), borderColor: alpha(cssColor, "40") }, chipStyle: { backgroundColor: alpha(cssColor, "22"), color: cssColor }, dotStyle: { backgroundColor: cssColor } };
    }
    return kindStyle[kind];
  }
  if (categories) {
    const cat = categories.find(c => c.id === kind);
    const cssColor = toCssColor(cat?.color);
    const effectiveTone = (cat?.tone && toneStyle[cat.tone]) ? cat.tone : (cat ? pickDefaultTone(kind) : undefined);
    if (effectiveTone && toneStyle[effectiveTone]) {
      const base = toneStyle[effectiveTone];
      if (cssColor) return { ...base, customColor: cssColor, blockStyle: { backgroundColor: alpha(cssColor, "18"), borderColor: alpha(cssColor, "40") }, chipStyle: { backgroundColor: alpha(cssColor, "22"), color: cssColor }, dotStyle: { backgroundColor: cssColor } };
      return base;
    }
    if (cssColor) return {
      ...FALLBACK_STYLE,
      customColor: cssColor,
      blockStyle: { backgroundColor: alpha(cssColor, "18"), borderColor: alpha(cssColor, "40") },
      chipStyle: { backgroundColor: alpha(cssColor, "22"), color: cssColor },
      dotStyle: { backgroundColor: cssColor },
    };
  }
  return FALLBACK_STYLE;
}

/* ---------------- Daily agenda (data-driven) ---------------- */
export function DailyAgenda() {
  const { data } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
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
              const s = safeKindStyle(a.kind, data.categories);
              const Icon = s.icon;
              const live = a.id === liveId;
              return (
                <li key={a.id} className="flex items-start gap-4">
                  <div className="w-[60px] pt-2 text-right num text-xs text-muted-foreground tabular-nums">
                    {a.start}
                    <div className="text-[10px] text-muted-foreground/70">{a.end}</div>
                  </div>
                  <div className="relative pt-2.5">
                    <span className={`block h-2.5 w-2.5 rounded-full ${s.dot} ${live ? "ring-4 ring-secondary/30" : ""}`} style={s.dotStyle} />
                  </div>
                  <div className={`flex-1 rounded-lg border ${live ? "border-secondary/40 bg-secondary/5" : "border-border bg-surface-raised"} p-3.5 flex items-center gap-3`}>
                    <div className={`h-8 w-8 rounded-md grid place-items-center ${s.chip}`} style={s.chipStyle}><Icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">{scheduleText.blockTitle(a.title, a.titleCustom)}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded ${s.chip} font-medium uppercase tracking-wider text-[10px]`} style={s.chipStyle}>{categoryLabel(data, a.kind, t, scheduleText.categoryLabel)}</span>
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
  const load = data.ledger.metrics.find((m) => m.label === "Load")?.value ?? 0;
  const consistency = data.ledger.metrics.find((m) => m.label === "Consistency")?.value ?? 0;
  const variety = data.ledger.metrics.find((m) => m.label === "Variety")?.value ?? 0;
  return (
    <div className="chronos-card p-6 h-full">

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
        <div className="rounded-md bg-surface-raised border border-border p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Load</div>
          <div className="font-display text-xl text-primary mt-0.5 num">{load}</div>
          <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-bronze" style={{ width: `${load}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5 leading-tight">Scheduled hours vs 40h baseline · 45% weight</div>
        </div>
        <div className="rounded-md bg-surface-raised border border-border p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Consistency</div>
          <div className="font-display text-xl text-primary mt-0.5 num">{consistency}</div>
          <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-bronze" style={{ width: `${consistency}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5 leading-tight">Evenness across weekdays · 30% weight</div>
        </div>
        <div className="rounded-md bg-surface-raised border border-border p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Variety</div>
          <div className="font-display text-xl text-primary mt-0.5 num">{variety}</div>
          <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-bronze" style={{ width: `${variety}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5 leading-tight">Categories used vs available · 25% weight</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- AI suggestions ---------------- */
export function AetherisCard({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [count, setCount] = useState(getAetherisCount());
  useEffect(() => subscribeNotif(setCount), []);
  const latestDaily = [...getAllDigests()].reverse().find((d) => d.timeframe === "daily") ?? getLatestDigest();
  return (
    <div className="chronos-card-elevated p-6 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-secondary/10 blur-2xl" />
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-bronze grid place-items-center shadow-bronze">
            <Sparkles className="h-4 w-4 text-primary-deep" />
          </div>
          <div>
            <div className="text-sm font-medium text-primary">{t.chronos.nav.aetheris}</div>
            <span className="text-[11px] text-muted-foreground">
              {count > 0
                ? `${count} ${count === 1 ? "item" : "items"} ${t.common.awaitingReview}`
                : t.chronos.aetheris.allQuietLead}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {count > 0 ? (
            <span className="text-[10px] font-semibold rounded-full bg-secondary text-primary-deep px-2 py-0.5 num">{count}</span>
          ) : (
            <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 flex items-center gap-1">
              <Check className="h-3 w-3" /> Clear
            </span>
          )}
          <Link
            to="/dashboard/aetheris"
            className="text-[10px] text-secondary hover:text-secondary/80 transition-colors flex items-center gap-1"
          >
            {t.chronos.widgets.viewAllSuggestions} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {latestDaily && (
        <div className="mt-4 border-t border-border/40 pt-4">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-2">{latestDaily.date}</div>
          <DigestView digest={latestDaily} />
        </div>
      )}
    </div>
  );
}

/* ---------------- Weekly routine planner ---------------- */

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function WeeklyRoutine({ editable = false, onBlockClick }: { editable?: boolean; onBlockClick?: (b: RoutineBlock) => void }) {
  const { data, removeRoutine } = useSchedule();
  const t = useT();
  const scheduleText = useScheduleText();
  const days = [1, 2, 3, 4, 5, 6, 0];
  const todayDow = new Date().getDay();

  // Dynamic window derived from user's sleep schedule
  const startHour = Math.max(0, Math.floor(timeToMinutes(data.meta.sleepWindow?.end ?? "06:30") / 60));
  const endHour = Math.min(24, Math.ceil(timeToMinutes(data.meta.sleepWindow?.start ?? "23:00") / 60));
  const totalHours = Math.max(1, endHour - startHour);
  const rowHeight = 30;
  const gridHeight = totalHours * rowHeight;

  const tickHours: number[] = [];
  for (let h = startHour; h <= endHour; h += 2) tickHours.push(h);

  // Expand crossday blocks into two visible segments
  const routineSegments = data.routine.flatMap((block) => {
    const spans = block.endsNextDay ?? block.end <= block.start;
    if (!spans) return [{ ...block, renderDay: block.day, renderStart: block.start, renderEnd: block.end }];
    return [
      { ...block, renderDay: block.day, renderStart: block.start, renderEnd: "23:59" },
      { ...block, renderDay: (block.day + 1) % 7, renderStart: "00:00", renderEnd: block.end },
    ];
  });

  const freeSlotsForDay = (day: number) => {
    const dayBlocks = routineSegments
      .filter((b) => b.renderDay === day && b.kind !== "sleep")
      .sort((a, b) => a.renderStart.localeCompare(b.renderStart));
    const slots: { start: string; end: string }[] = [];
    let cursor = startHour * 60;
    const dayEnd = endHour * 60;
    for (const block of dayBlocks) {
      const bs = Math.max(cursor, Math.min(dayEnd, timeToMinutes(block.renderStart)));
      const be = Math.max(cursor, Math.min(dayEnd, timeToMinutes(block.renderEnd === "23:59" ? "24:00" : block.renderEnd)));
      if (bs - cursor >= 15) slots.push({ start: minsToTime(cursor), end: minsToTime(bs) });
      cursor = Math.max(cursor, be);
    }
    if (dayEnd - cursor >= 15) slots.push({ start: minsToTime(cursor), end: minsToTime(dayEnd) });
    return slots;
  };

  return (
    <div className="chronos-card p-6 lg:col-span-3">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.composer}</div>
          <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.weekShape}</h3>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {data.categories.filter((c) => c.id !== "sleep").map((c) => {
            const s = safeKindStyle(c.id, data.categories);
            return (
              <div key={c.id} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} style={s.dotStyle} />
                <span className="text-muted-foreground">{scheduleText.categoryLabel(c.id as BlockKind, c.label, c.labelCustom)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[48px_repeat(7,1fr)] gap-1.5">
        <div />
        {days.map((di) => (
          <div key={di} className={`text-center text-[11px] uppercase tracking-[0.18em] pb-2 ${di === todayDow ? "text-secondary font-semibold" : "text-muted-foreground"}`}>
            {t.common.days.short[di]}
          </div>
        ))}

        {/* Time axis */}
        <div className="relative" style={{ height: gridHeight }}>
          {tickHours.map((h) => (
            <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] num text-muted-foreground/60 leading-none" style={{ top: ((h - startHour) / totalHours) * gridHeight }}>
              {String(h).padStart(2, "0")}h
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((di) => {
          const segs = routineSegments.filter((b) => b.renderDay === di && b.kind !== "sleep");
          const isToday = di === todayDow;
          return (
            <div
              key={`col-${di}`}
              className={`relative rounded-md border ${isToday ? "bg-secondary/5 border-secondary/25" : "bg-surface-raised border-border/60"}`}
              style={{ height: gridHeight }}
            >
              {/* Horizontal grid lines */}
              {tickHours.slice(1).map((h) => (
                <div key={`gl-${h}`} className="absolute left-0 right-0 border-t border-dashed border-border/40" style={{ top: ((h - startHour) / totalHours) * gridHeight }} />
              ))}

              {/* Free slots */}
              {freeSlotsForDay(di).map((slot) => {
                const sh = timeToMinutes(slot.start) / 60;
                const eh = timeToMinutes(slot.end === "24:00" ? "24:00" : slot.end) / 60;
                const csh = Math.max(startHour, sh);
                const ceh = Math.min(endHour, eh);
                if (ceh <= csh) return null;
                const top = ((csh - startHour) / totalHours) * gridHeight;
                const height = Math.max(6, ((ceh - csh) / totalHours) * gridHeight - 2);
                return (
                  <div
                    key={`free-${slot.start}`}
                    className="absolute left-1 right-1 rounded border border-dashed border-border/40 bg-background/20 px-1 py-0.5 overflow-hidden"
                    style={{ top, height }}
                    title={`${t.chronos.today.free} · ${slot.start}–${slot.end}`}
                  >
                    {height >= 20 && <div className="truncate text-[8px] uppercase tracking-wider text-muted-foreground/45">{t.chronos.today.free}</div>}
                  </div>
                );
              })}

              {/* Routine blocks — clamped to the visible window */}
              {segs.map((b) => {
                const sh = timeToMinutes(b.renderStart) / 60;
                const rawEh = b.renderEnd === "23:59" ? 24 : timeToMinutes(b.renderEnd) / 60;
                const csh = Math.max(startHour, sh);
                const ceh = Math.min(endHour, rawEh);
                if (ceh <= csh) return null;
                const top = ((csh - startHour) / totalHours) * gridHeight;
                const height = Math.max(14, ((ceh - csh) / totalHours) * gridHeight - 2);
                const s = safeKindStyle(b.kind, data.categories);
                const clickable = !!onBlockClick;
                return (
                  <div
                    key={`${b.id}-${b.renderStart}`}
                    className={`group absolute left-1 right-1 rounded text-[10px] font-medium px-1.5 py-0.5 ${s.chip} border border-current/10 overflow-hidden select-none ${clickable ? "cursor-pointer hover:brightness-110 hover:ring-1 hover:ring-primary/20" : ""}`}
                    style={s.chipStyle ? { top, height, ...s.chipStyle } : { top, height }}
                    title={`${scheduleText.blockTitle(b.title, b.titleCustom)} · ${b.renderStart}–${b.renderEnd}`}
                    onClick={() => clickable && onBlockClick(b as unknown as RoutineBlock)}
                  >
                    <div className="truncate leading-tight">{scheduleText.blockTitle(b.title, b.titleCustom)}</div>
                    {height >= 28 && <div className="text-[8px] opacity-60 num">{b.renderStart}</div>}
                    {editable && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeRoutine(b.id); toast({ title: t.chronos.widgets.blockRemoved }); }}
                        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 h-4 w-4 rounded grid place-items-center bg-background/70 hover:bg-background"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Focus blocks card ---------------- */
export function FocusBlocksCard() {
  const { data } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const focusIds = data.meta.focusCategoryIds ?? [];
  const today = new Date();

  if (focusIds.length === 0) {
    return (
      <div className="chronos-card p-6 h-full flex flex-col">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.focus}</div>
            <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.focusToday}</h3>
          </div>
        </div>
        <div className="flex-1 grid place-items-center">
          <p className="text-sm text-muted-foreground text-center max-w-[20ch] leading-relaxed">
            {t.chronos.widgets.focusPickCategory}
          </p>
        </div>
        <Link
          to="/dashboard"
          className="w-full h-10 rounded-md border border-secondary/30 bg-primary text-primary-foreground text-sm hover:bg-primary-deep inline-flex items-center justify-center gap-2 shadow-sm"
        >
          {t.chronos.widgets.openFocusRoom}
        </Link>
      </div>
    );
  }

  const agenda = buildAgendaForDate(data, today).filter(
    (a) => focusIds.includes(a.kind) && durationMin(a.start, a.end) >= 15,
  );
  const sorted = [...agenda].sort((a, b) => durationMin(b.start, b.end) - durationMin(a.start, a.end));
  const top = sorted.slice(0, 5);
  const totalMin = top.reduce((s, a) => s + durationMin(a.start, a.end), 0);

  return (
    <div className="chronos-card p-6 h-full flex flex-col">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.focus}</div>
          <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.focusToday}</h3>
        </div>
        <span className="text-xs text-muted-foreground num">{t.chronos.widgets.focusComposed(top.length, fmtDur(totalMin))}</span>
      </div>
      {top.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground italic">{t.chronos.widgets.focusEmpty}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {top.map((s) => {
            const dur = durationMin(s.start, s.end);
            const pct = Math.min(100, Math.round((dur / 120) * 100));
            return (
              <li key={s.id} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
                  <Brain className="h-4 w-4 text-secondary-soft" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-primary truncate">{scheduleText.blockTitle(s.title, s.titleCustom)}</div>
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
      <Link
        to="/dashboard/focus"
        className="mt-5 w-full h-10 rounded-md border border-secondary/30 bg-primary text-primary-foreground text-sm hover:bg-primary-deep inline-flex items-center justify-center gap-2 shadow-sm"
      >
        {t.chronos.widgets.openFocusRoom} <ArrowUpRight className="h-4 w-4 text-primary-foreground" />
      </Link>
    </div>
  );
}

export const TAILWIND_TO_HEX: Record<string, string> = {
  "bg-amber-500": "#f59e0b",
  "bg-amber-600": "#d97706",
  "bg-amber-400": "#fbbf24",
  "bg-blue-500": "#3b82f6",
  "bg-violet-500": "#8b5cf6",
  "bg-emerald-500": "#10b981",
  "bg-emerald-400": "#34d399",
  "bg-slate-400": "#94a3b8",
  "bg-slate-500": "#64748b",
  "bg-indigo-400": "#818cf8",
  "bg-indigo-500": "#6366f1",
  "bg-indigo-600": "#4f46e5",
  "bg-sky-500": "#0ea5e9",
  "bg-rose-500": "#f43f5e",
  "bg-rose-400": "#fb7185",
  "bg-lime-500": "#84cc16",
  "bg-muted-foreground": "#6b7280",
};

export const COLOR_FAMILIES = [
  {
    family: "Crimson",
    shades: ["#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c"],
  },
  {
    family: "Rose",
    shades: ["#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c"],
  },
  {
    family: "Amber",
    shades: ["#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309"],
  },
  {
    family: "Chartreuse",
    shades: ["#bef264", "#a3e635", "#84cc16", "#65a30d", "#4d7c0f"],
  },
  {
    family: "Emerald",
    shades: ["#6ee7b7", "#34d399", "#10b981", "#059669", "#047857"],
  },
  {
    family: "Teal",
    shades: ["#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e"],
  },
  {
    family: "Sky",
    shades: ["#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1"],
  },
  {
    family: "Violet",
    shades: ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9"],
  },
  {
    family: "Indigo",
    shades: ["#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca"],
  },
  {
    family: "Slate",
    shades: ["#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155"],
  },
];

/** Flat list of all system hex colors */
export const COLOR_PALETTE = COLOR_FAMILIES.flatMap((f) => f.shades);

/* ---------------- Focus vs other chart ---------------- */
export function BalanceCard() {
  const { data } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const DAYS = 14;
  const focusIds = data.meta.focusCategoryIds ?? [];

  if (focusIds.length === 0) {
    return (
      <div className="chronos-card p-6 h-full flex flex-col">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.equilibrium}</div>
            <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.balanceTitle}</h3>
          </div>
        </div>
        <div className="flex-1 grid place-items-center">
          <p className="text-sm text-muted-foreground text-center max-w-[20ch] leading-relaxed">
            {t.chronos.widgets.focusPickCategory}
          </p>
        </div>
      </div>
    );
  }

  const allCats = new Set(data.categories.map((c) => c.id));
  const dayMin = (day: number, id: string) =>
    data.routine
      .filter((r) => r.day === day && r.kind === id)
      .reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);
  const dayMinAll = (day: number, ids: Set<string>) =>
    data.routine
      .filter((r) => r.day === day && ids.has(r.kind))
      .reduce((sum, r) => sum + Math.max(0, timeToMinutes(r.end) - timeToMinutes(r.start)), 0);

  const focusLines = focusIds.map((id) => {
    const dayMins = Array.from({ length: DAYS }, (_, i) => dayMin(i % 7, id));
    const hours = dayMins.map((m) => Math.round(m / 6) / 10);
    const totalMin = Math.round(dayMins.reduce((s, v) => s + v, 0) / 2);
    const style = safeKindStyle(id, data.categories);
    const color = style.customColor ?? TAILWIND_TO_HEX[style.dot] ?? "hsl(var(--primary))";
    const name = t.common.kinds[id] ?? data.categories.find((c) => c.id === id)?.label ?? id;
    return { hours, totalMin, color, name };
  });

  const otherSet = new Set([...allCats].filter((c) => !focusIds.includes(c)));
  const otherDayMins = Array.from({ length: DAYS }, (_, i) => dayMinAll(i % 7, otherSet));
  const otherHours = otherDayMins.map((m) => Math.round(m / 6) / 10);
  const otherTotalMin = Math.round(otherDayMins.reduce((s, v) => s + v, 0) / 2);

  const max = Math.max(...focusLines.flatMap((l) => l.hours), ...otherHours, 1);
  const W = 320, H = 120, P = 8;
  const x = (i: number) => P + (i / (DAYS - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const makePath = (hours: number[]) =>
    hours.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const lastIdx = DAYS - 1;
  const OTHER_COLOR = "#94a3b8";

  return (
    <div className="chronos-card p-6 h-full flex flex-col">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.equilibrium}</div>
          <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.balanceTitle}</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap justify-end">
          {focusLines.map((l) => (
            <span key={l.name} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: l.color }} /> {l.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: OTHER_COLOR }} /> {t.chronos.widgets.other}
          </span>
        </div>
      </div>
      <div className="mt-5 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            {focusLines.map((_, i) => (
              <linearGradient key={`fg-${i}`} id={`focusFill-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={focusLines[i].color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={focusLines[i].color} stopOpacity="0" />
              </linearGradient>
            ))}
            <linearGradient id="otherFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={OTHER_COLOR} stopOpacity="0.28" />
              <stop offset="100%" stopColor={OTHER_COLOR} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="2 4" />
          ))}
          <path d={`${makePath(otherHours)} L ${x(lastIdx)} ${H - P} L ${x(0)} ${H - P} Z`} fill="url(#otherFill)" />
          <path d={makePath(otherHours)} fill="none" stroke={OTHER_COLOR} strokeWidth="2" strokeDasharray="4 3" />
          <circle cx={x(lastIdx)} cy={y(otherHours[lastIdx])} r="3" fill={OTHER_COLOR} />
          {focusLines.map((l, i) => (
            <g key={l.name}>
              <path d={`${makePath(l.hours)} L ${x(lastIdx)} ${H - P} L ${x(0)} ${H - P} Z`} fill={`url(#focusFill-${i})`} />
              <path d={makePath(l.hours)} fill="none" stroke={l.color} strokeWidth="2" />
              <circle cx={x(lastIdx)} cy={y(l.hours[lastIdx])} r="3" fill={l.color} />
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {focusLines.map((l) => (
          <div key={l.name} className="rounded-md bg-surface-raised border p-3">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} /> {t.chronos.widgets.total}
            </div>
            <div className="font-display text-xl text-primary mt-0.5 num">
              {fmtDur(l.totalMin)} <span className="text-xs text-muted-foreground font-sans">{l.name}</span>
            </div>
          </div>
        ))}
        <div className="rounded-md bg-surface-raised border p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: OTHER_COLOR }} /> {t.chronos.widgets.total}
          </div>
          <div className="font-display text-xl text-primary mt-0.5 num">
            {fmtDur(otherTotalMin)} <span className="text-xs text-muted-foreground font-sans">{t.chronos.widgets.other}</span>
          </div>
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
  const catMins = data.categories.map((c) => ({
    id: c.id,
    min: data.routine.filter((r) => r.kind === c.id).reduce((s, b) => s + durationMin(b.start, b.end), 0),
  }));
  const topCat = catMins.reduce((best, c) => (c.min > best.min ? c : best), { id: "", min: 0 });
  const activeDaysSet = new Set<number>();
  data.routine.forEach((r) => activeDaysSet.add(r.day));
  const activeDays = activeDaysSet.size;
  const catUsedCount = catMins.filter((c) => c.min > 0).length;
  const cards = [
    { k: t.chronos.widgets.composedWeekly, v: fmtDur(totalRoutineMin), d: t.chronos.widgets.composedWeeklyDesc(data.routine.length), trend: t.chronos.widgets.thisWeek },
    { k: t.chronos.widgets.topCat,         v: `${Math.round((topCat.min / Math.max(1, totalRoutineMin)) * 100)}%`, d: t.chronos.widgets.topCatDesc, trend: t.chronos.widgets.topCatTrend },
    { k: t.chronos.widgets.daySpread,      v: `${activeDays} / 7`, d: t.chronos.widgets.daySpreadDesc, trend: t.chronos.widgets.daySpreadBase },
    { k: t.chronos.widgets.catUsed,        v: catUsedCount === data.categories.length ? t.chronos.widgets.catUsedAll : `${catUsedCount} / ${data.categories.length}`, d: t.chronos.widgets.catUsedDesc, trend: t.chronos.widgets.catUsedTrend },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.k} className="chronos-card p-5 cursor-default" tabIndex={-1}>
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

/* ---------------- Focus categories inline picker ---------------- */
export function FocusCategoryPicker() {
  const { data, setFocusCategories } = useSchedule();
  const t = useT();
  const scheduleText = useScheduleText();
  const selected = data.meta.focusCategoryIds ?? [];
  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setFocusCategories(next);
  }
  return (
    <div className="space-y-1.5">
      {data.categories.map((c) => {
        const on = selected.includes(c.id);
        const s = on ? safeKindStyle(c.id, data.categories) : null;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={`w-full flex items-center gap-3 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
              on
                ? "border-primary/50 bg-primary/5 text-primary"
                : "border-border/60 text-muted-foreground hover:border-border hover:text-primary"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${on ? s!.dot : "bg-secondary/40"}`} style={s?.dotStyle} />
            <span className="flex-1">{scheduleText.categoryLabel(c.id, c.label, c.labelCustom)}</span>
            {on && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
