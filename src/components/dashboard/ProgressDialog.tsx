import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Target, BarChart3, Hash, Clock, CalendarDays, CheckCircle2, Calendar } from "lucide-react";
import { useSchedule } from "@/lib/schedule/store";
import { useT, useFmtDur, useI18n } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { fmtDur, computeGoalProgress } from "@/lib/schedule/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProgressDialog({ open, onOpenChange }: Props) {
  const { data, overallGoalProgress } = useSchedule();
  const t = useT();
  const scheduleText = useScheduleText();
  const fmtDur = useFmtDur();
  const { bcp47 } = useI18n();
  const cycle = data.meta.cycle;
  const ledger = data.ledger;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const elapsedMin = dayOfWeek * 1440 + now.getHours() * 60 + now.getMinutes();
  const weekPct = Math.round((elapsedMin / 10080) * 100);

  const routineHours = data.routine.reduce((s, r) => {
    const dur = (parseInt(r.end.split(":")[0]) * 60 + parseInt(r.end.split(":")[1])) - (parseInt(r.start.split(":")[0]) * 60 + parseInt(r.start.split(":")[1]));
    return s + Math.max(0, dur);
  }, 0);

  const goalProgress = overallGoalProgress();
  const goals = data.goals;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">{t.chronos.nav.cycle} {cycle.number} · {t.chronos.nav.week_short} {cycle.week}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-secondary" />
              <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.nav.week}</span>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary font-medium">{weekPct}%</span>
                <span className="text-xs text-muted-foreground">{t.chronos.nav.cycle} {cycle.number} · {t.chronos.nav.week_short} {cycle.week}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-bronze" style={{ width: `${weekPct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground mt-2 space-y-1">
                <div>{now.toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "long" })}</div>
                <div className="text-[11px]">
                  {elapsedMin.toLocaleString(bcp47)} / 10.080 min
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-secondary" />
              <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">{scheduleText.cycleName(cycle.name)}</span>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary font-medium">{ledger.compositionScore}/100</span>
                <span className="text-xs text-muted-foreground">{t.chronos.widgets.compositionScore}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                {ledger.metrics.filter((m) => m.label !== "Goals").slice(0, 3).map((m, i) => (
                  <div key={m.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{
                    width: `${Math.min(100, m.value)}%`,
                    backgroundColor: i === 0 ? "#f59e0b" : i === 1 ? "#3b82f6" : i === 2 ? "#10b981" : undefined,
                  }} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {ledger.metrics.filter((m) => m.label !== "Goals").slice(0, 3).map((m, i) => (
                  <div key={m.label}>
                    <div className="text-xs num text-primary font-medium">{m.value}%</div>
                    <div className="text-[10px] text-muted-foreground">{m.label}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground border-t border-border/40 pt-2 mt-1">
                {t.chronos.ledger.clarityLead}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-secondary" />
              <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.goals.eyebrow}</span>
            </div>
            {goals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                {t.chronos.goals.noGoalsYet}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">{t.chronos.goals.progress}</span>
                  <span className="num text-primary font-medium">{Math.round(goalProgress * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-bronze" style={{ width: `${Math.round(goalProgress * 100)}%` }} />
                </div>
                <div className="space-y-2 mt-3">
                  {goals.map((g) => {
                    const p = computeGoalProgress(g, undefined, undefined, data.routine, data.commitments);
                    return (
                      <div key={g.id} className="rounded-md border border-border/40 bg-background p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-primary truncate font-medium">{g.title}</span>
                          <span className="text-[10px] num text-muted-foreground shrink-0">
                            {g.kind === "duration" ? fmtDur(p.numerator) : p.numerator}/{g.kind === "duration" ? fmtDur(p.denominator) : p.denominator}
                            {g.unit ? ` ${g.unit}` : ""}
                          </span>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.round(p.ratio * 100)}%`, backgroundColor: g.color ?? "#f59e0b" }} />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{g.kind === "duration" ? t.chronos.goals.kindDuration : g.kind === "numeric" ? t.chronos.goals.kindNumeric : t.chronos.goals.kindDeadline}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">{t.chronos.goals.periodDaily !== g.period && t.chronos.goals.periodWeekly !== g.period && t.chronos.goals.periodMonthly !== g.period ? g.period : ""}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/40 pt-4">
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="num text-primary font-medium">{data.routine.length}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t.chronos.widgets.composer}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="num text-primary font-medium">{data.categories.length}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t.chronos.widgets.legendKinds}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="num text-primary font-medium">{fmtDur(routineHours)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t.chronos.today.duration}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="num text-primary font-medium">{goals.length}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t.chronos.goals.eyebrow.toLowerCase()}</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
