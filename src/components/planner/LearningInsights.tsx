import type { LearningProfile, CategoryPreference, ProductivityWindow } from "@/lib/ai/learning/types";
import { DAY_LABELS } from "@/lib/schedule/types";
import { Brain, Clock, Target, Zap, BarChart3, Layers } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-muted-foreground w-20 truncate shrink-0">{label}</span>}
      <div className="flex-1 h-2 rounded-full bg-secondary/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-secondary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground num w-8 text-right">{pct}%</span>
    </div>
  );
}

function HeatCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? Math.min(1, value / max) : 0;
  const bg =
    intensity === 0
      ? "bg-secondary/5"
      : intensity < 0.25
        ? "bg-secondary/15"
        : intensity < 0.5
          ? "bg-secondary/30"
          : intensity < 0.75
            ? "bg-secondary/50"
            : "bg-secondary/70";
  return (
    <div
      className={`h-10 w-full rounded-md ${bg} flex items-center justify-center text-[10px] num text-muted-foreground`}
      title={`${Math.round(value)} focus min`}
    >
      {value > 0 ? Math.round(value) : "—"}
    </div>
  );
}

const TIME_BLOCK_LABELS = ["6–12", "12–18", "18–24"];
const TIME_BLOCK_RANGES: { start: number; end: number }[] = [
  { start: 360, end: 720 },
  { start: 720, end: 1080 },
  { start: 1080, end: 1440 },
];

function findWindow(
  windows: ProductivityWindow[],
  day: number,
  blockIndex: number
): ProductivityWindow | undefined {
  const range = TIME_BLOCK_RANGES[blockIndex];
  if (!range) return undefined;
  return windows.find(
    (w) => w.dayOfWeek === day && w.startMin >= range.start && w.endMin <= range.end
  );
}

export default function LearningInsights({ profile }: { profile: LearningProfile }) {
  const t = useT();
  const l = t.chronos.learning;

  if (profile.totalDaysTracked === 0) {
    return (
      <div className="chronos-card p-8 text-center">
        <Brain className="h-10 w-10 text-secondary mx-auto mb-3" />
        <p className="text-sm text-muted-foreground italic">{l.noData}</p>
      </div>
    );
  }

  const maxWindowScore = Math.max(
    1,
    ...profile.productivityWindows.map((w) => w.averageFocusScore)
  );

  const bestWindow = profile.productivityWindows.reduce<ProductivityWindow | null>(
    (best, w) =>
      !best || w.averageFocusScore > best.averageFocusScore ? w : best,
    null
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5 mb-2">
        <Brain className="h-5 w-5 text-secondary" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">
            {l.eyebrow}
          </div>
          <h2 className="font-display text-2xl text-primary">{l.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{l.lead}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="chronos-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">{l.daysTracked}</span>
          </div>
          <div className="font-display text-2xl text-primary num">{profile.totalDaysTracked}</div>
        </div>
        <div className="chronos-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">{l.avgFocus}</span>
          </div>
          <div className="font-display text-2xl text-primary num">
            {fmtMin(profile.averageFocusMinutesPerDay)}
          </div>
        </div>
        <div className="chronos-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Layers className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">{l.avgRecovery}</span>
          </div>
          <div className="font-display text-2xl text-primary num">
            {fmtMin(profile.averageRecoveryMinutesPerDay)}
          </div>
        </div>
        <div className="chronos-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Target className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase tracking-wider">{l.completionRate}</span>
          </div>
          <div className="font-display text-2xl text-primary num">
            {Math.round(profile.averageCompletionRate * 100)}%
          </div>
        </div>
      </div>

      {profile.categoryPreferences.length > 0 && (
        <div className="chronos-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            {l.categoryPreferences}
          </h3>
          <div className="space-y-3">
            {profile.categoryPreferences.slice(0, 8).map((pref: CategoryPreference) => (
              <div key={pref.categoryId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-primary">{pref.categoryId}</span>
                  <span className="text-xs text-muted-foreground num">
                    {pref.totalSessions} sessions · {fmtMin(pref.averageDurationMin)} avg
                  </span>
                </div>
                <ProgressBar value={pref.completionRate} max={1} />
              </div>
            ))}
          </div>
        </div>
      )}

      {profile.productivityWindows.length > 0 && (
        <div className="chronos-card p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            {l.productivityWindows}
          </h3>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[auto_repeat(7,1fr)] gap-1 min-w-[400px]">
              <div className="text-[10px] text-muted-foreground px-2 py-1" />
              {DAY_LABELS.map((day) => (
                <div
                  key={day}
                  className="text-[10px] text-muted-foreground text-center py-1"
                >
                  {day}
                </div>
              ))}
              {TIME_BLOCK_LABELS.map((label, bi) => (
                <div key={label} className="contents">
                  <div className="text-[10px] text-muted-foreground px-2 py-1 flex items-center">
                    {label}
                  </div>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const w = findWindow(profile.productivityWindows, day, bi);
                    return (
                      <HeatCell
                        key={`${day}-${bi}`}
                        value={w?.averageFocusScore ?? 0}
                        max={maxWindowScore}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {bestWindow && (
        <div className="chronos-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-secondary" />
            <span className="text-xs font-medium uppercase tracking-wider text-secondary">
              {l.mostProductive}
            </span>
          </div>
          <p className="text-sm text-primary">
            {DAY_LABELS[bestWindow.dayOfWeek]} ·{" "}
            {fmtMin(bestWindow.startMin)}–{fmtMin(bestWindow.endMin)} ·{" "}
            {Math.round(bestWindow.averageFocusScore)} avg focus min
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {profile.commonlyUsedCategories.length > 0 && (
          <div className="chronos-card p-5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-emerald-500 mb-3">
              {l.commonlyUsed}
            </h3>
            <ul className="space-y-1">
              {profile.commonlyUsedCategories.map((cat) => (
                <li key={cat} className="text-sm text-primary flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  {cat}
                </li>
              ))}
            </ul>
          </div>
        )}
        {profile.neglectedCategories.length > 0 && (
          <div className="chronos-card p-5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              {l.neglected}
            </h3>
            <ul className="space-y-1">
              {profile.neglectedCategories.map((cat) => (
                <li key={cat} className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  {cat}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
