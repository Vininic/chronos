import { useState } from "react";
import { WeeklyRoutine, PerformanceCard, BalanceCard, OptimizationStrip, safeKindStyle } from "@/components/dashboard/widgets";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { GoalList } from "@/components/dashboard/GoalList";
import { useSchedule } from "@/lib/schedule/store";
import type { Commitment, Goal, RoutineBlock } from "@/lib/schedule/types";
import { BlockKind, durationMin, computeGoalProgress, computeStreak, getPeriodStartEnd, daysUntilDeadline } from "@/lib/schedule/types";
import type { GoalFields } from "@/components/dashboard/GoalDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Target, BarChart3, Clock, CheckCircle2, CalendarDays, TrendingUp, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useFmtDur, useT, useI18n } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/ui/time-select";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TabId = "week" | "month";

export default function Week() {
  const { data, removeRoutine, updateRoutine, addGoal, updateGoal, removeGoal, addGoalBlock, toggleGoalBlock, toggleGoalSubTask, addGoalSubTask, generateGoalCommitments } = useSchedule();
  const t = useT();
  const { bcp47 } = useI18n();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const [editItem, setEditItem] = useState<RoutineBlock | null>(null);
  const [tab, setTab] = useState<TabId>("week");
  const isPt = bcp47.toLowerCase().startsWith("pt");

  function patchRoutine(id: string, patch: Record<string, unknown>, successTitle = t.common.save) {
    const err = updateRoutine(id, patch);
    if (err) {
      toast({ title: t.chronos.weekPage.schedulingConflict, description: err });
      return;
    }
    toast({ title: successTitle });
  }

  function handleSave(item: RoutineBlock, patch: Partial<RoutineBlock>) {
    patchRoutine(item.id, patch, t.common.save);
    setEditItem(null);
  }

  function handleRemove(item: RoutineBlock) {
    removeRoutine(item.id);
    toast({ title: t.chronos.weekPage.blockRemoved });
    setEditItem(null);
  }

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const startDow = monthStart.getDay();
  const commitmentsByDate: Record<string, Commitment[]> = {};
  data.commitments.forEach((c) => {
    if (!commitmentsByDate[c.date]) commitmentsByDate[c.date] = [];
    commitmentsByDate[c.date].push(c);
  });

  const todayIso = today.toISOString().slice(0, 10);
  const totalSchedMin = data.routine.reduce((s, r) => {
    if (today.getDay() === r.day) return s + durationMin(r.start, r.end);
    return s;
  }, 0);
  const goalStats = data.goals.reduce((acc, g) => {
    const p = computeGoalProgress(g, todayIso, data.goals, data.routine, data.commitments);
    acc.total++;
    if (p.denominator > 0 && p.ratio >= 1) acc.completed++;
    acc.weightedSum += p.ratio * g.weight;
    acc.totalWeight += g.weight;
    return acc;
  }, { total: 0, completed: 0, weightedSum: 0, totalWeight: 0 });
  const avgProgress = goalStats.totalWeight > 0 ? goalStats.weightedSum / goalStats.totalWeight : 0;
  const goalsToday = data.goals.filter((g) => {
    const pp = getPeriodStartEnd(g.startDate, g.period, todayIso);
    return todayIso >= pp.start && todayIso <= pp.end;
  }).length;
  const bestStreak = data.goals.reduce((best, g) => Math.max(best, computeStreak(g, todayIso)), 0);
  const deadlineGoals = data.goals
    .filter((g): g is Goal & { deadline: string } => g.kind === "deadline" && !!g.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5);

  const routineByDay: Map<number, RoutineBlock[]> = new Map();
  for (let d = 0; d < 7; d++) routineByDay.set(d, []);
  data.routine.forEach((r) => routineByDay.get(r.day)?.push(r));

  const weekRows: { weekStart: Date; weekEnd: Date; goals: Goal[] }[] = [];
  {
    const firstDay = new Date(monthStart);
    while (firstDay.getDay() !== 0) firstDay.setDate(firstDay.getDate() - 1);
    const cursor = new Date(firstDay);
    while (cursor <= monthEnd || cursor.getDay() !== 0) {
      const ws = new Date(cursor);
      const we = new Date(cursor);
      we.setDate(we.getDate() + 6);
      const activeGoals = data.goals.filter((g) => {
        const pp = getPeriodStartEnd(g.startDate, g.period, todayIso);
        const weekStartIso = ws.toISOString().slice(0, 10);
        const weekEndIso = we.toISOString().slice(0, 10);
        return !(pp.end < weekStartIso || pp.start > weekEndIso);
      });
      weekRows.push({ weekStart: ws, weekEnd: we, goals: activeGoals });
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return (
    <>
      <header className="mb-6 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.weekPage.eyebrow}</div>
          <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.weekPage.title}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.weekPage.lead}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-border/60 overflow-hidden">
            <button
              onClick={() => setTab("week")}
              className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${tab === "week" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-primary hover:bg-muted/40"}`}
            >
              {t.chronos.nav.week}
            </button>
            <button
              onClick={() => setTab("month")}
              className={`px-3.5 py-1.5 text-xs font-medium transition-colors ${tab === "month" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-primary hover:bg-muted/40"}`}
            >
              {isPt ? "Mês" : "Month"}
            </button>
          </div>
          <ComposeBlockDialog />
        </div>
      </header>

      {/* Upcoming deadlines — visible in both week and month */}
      {deadlineGoals.length > 0 && (
        <div className="mb-5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
            <CalendarDays className="h-3 w-3" />
            <span>{isPt ? "Prazos" : "Deadlines"}</span>
          </div>
          {deadlineGoals.map((g) => {
            const d = daysUntilDeadline(g.deadline);
            const overdue = d < 0;
            return (
              <div
                key={g.id}
                className={`rounded-md border px-2.5 py-1 text-xs flex items-center gap-2 ${overdue ? "border-rose-500/30 bg-rose-500/8" : d <= 3 ? "border-amber-500/30 bg-amber-500/8" : "border-border/60"}`}
              >
                <span className="text-primary font-medium truncate max-w-[120px]">{g.title}</span>
                <span className={`num ${overdue ? "text-rose-600" : d <= 3 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {overdue ? `${Math.abs(d)}d ${isPt ? "em atraso" : "overdue"}` : `${d}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === "week" ? (
        <>
          {/* Mini stats row */}
          <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="chronos-card p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <Target className="h-3 w-3" /><span>{isPt ? "Metas" : "Goals"}</span>
              </div>
              <div className="text-lg font-display text-primary">{goalStats.total}</div>
              <div className="text-[10px] text-muted-foreground">{goalStats.completed} {isPt ? "concluídas esta semana" : "completed this week"}</div>
            </div>
            <div className="chronos-card p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <BarChart3 className="h-3 w-3" /><span>{isPt ? "Progresso" : "Progress"}</span>
              </div>
              <div className="text-lg font-display text-primary">{Math.round(avgProgress * 100)}%</div>
              <div className="text-[10px] text-muted-foreground">{isPt ? "média ponderada" : "weighted average"}</div>
            </div>
            <div className="chronos-card p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <Clock className="h-3 w-3" /><span>{isPt ? "Hoje" : "Today"}</span>
              </div>
              <div className="text-lg font-display text-primary">{fmtDur(totalSchedMin)}</div>
              <div className="text-[10px] text-muted-foreground">{goalsToday} {isPt ? "metas ativas" : "active goals"}</div>
            </div>
            <div className="chronos-card p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <CheckCircle2 className="h-3 w-3" /><span>Streak</span>
              </div>
              <div className="text-lg font-display text-primary">{bestStreak}</div>
              <div className="text-[10px] text-muted-foreground">{isPt ? "melhor sequência de meta" : "best goal streak"}</div>
            </div>
          </div>

          {/* Performance + Balance cards */}
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="chronos-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-secondary" />
                <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.perfIndex}</span>
              </div>
              <PerformanceCard />
            </div>
            <div className="chronos-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-secondary" />
                <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.balanceTitle}</span>
              </div>
              <BalanceCard />
            </div>
          </div>

          {/* Optimization strip */}
          <div className="mb-6">
            <OptimizationStrip />
          </div>

          {/* Weekly routine grid */}
          <div className="grid grid-cols-1 gap-6">
            <WeeklyRoutine
              onBlockClick={(b) => {
                const original = data.routine.find((r) => r.id === b.id);
                if (original) setEditItem(original);
              }}
            />
          </div>
        </>
      ) : (
        <>
          {/* Month view */}
          <section className="chronos-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{isPt ? "Visão mensal" : "Month view"}</div>
                <h3 className="font-display text-2xl text-primary mt-0.5">
                  {today.toLocaleDateString(bcp47, { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase())}
                </h3>
              </div>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                <div key={d} className="bg-muted/30 px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground text-center font-medium">
                  {t.common.days.short[d]}
                </div>
              ))}
              {Array.from({ length: startDow }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-background min-h-[90px] p-1" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayOfWeek = new Date(today.getFullYear(), today.getMonth(), day).getDay();
                const dayCommitments = [...(commitmentsByDate[dateStr] ?? [])].sort((a, b) => {
                  const aImp = a.priority?.important ? 0 : 1;
                  const bImp = b.priority?.important ? 0 : 1;
                  return aImp - bImp || a.start.localeCompare(b.start);
                });
                const dayRoutines = routineByDay.get(dayOfWeek) ?? [];
                const isToday = dateStr === todayIso;
                return (
                  <div key={day} className={`bg-background min-h-[90px] p-1.5 ${isToday ? "ring-1 ring-secondary/40 ring-inset" : ""}`}>
                    <div className={`text-xs font-medium mb-1 ${isToday ? "text-secondary" : "text-muted-foreground"}`}>{day}</div>
                    {dayRoutines.length > 0 && (
                      <div className="space-y-0.5 mb-1">
                        {dayRoutines.slice(0, 2).map((r) => {
                          const rs = safeKindStyle(r.kind, data.categories);
                          return (
                            <div key={r.id} className="rounded-sm px-1 py-0.5 text-[9px] text-primary truncate" style={{ backgroundColor: rs.blockStyle?.backgroundColor ?? "hsl(var(--primary) / 0.1)", borderColor: rs.blockStyle?.borderColor ?? "transparent" }} title={`${r.start}–${r.end} ${scheduleText.blockTitle(r.title, r.titleCustom)}`}>
                              {r.start} {scheduleText.blockTitle(r.title, r.titleCustom)}
                            </div>
                          );
                        })}
                        {dayRoutines.length > 2 && (
                          <div className="text-[8px] text-muted-foreground pl-1">+{dayRoutines.length - 2} mais</div>
                        )}
                      </div>
                    )}
                    {dayCommitments.length > 0 && (
                      <div className="space-y-0.5">
                        {dayCommitments.slice(0, 2).map((c) => {
                          const cs = safeKindStyle(c.kind, data.categories);
                          return (
                            <div key={c.id} className="rounded-sm px-1 py-0.5 text-[9px] text-primary truncate" style={{ backgroundColor: cs.blockStyle?.backgroundColor ?? "hsl(var(--secondary) / 0.15)", borderColor: cs.blockStyle?.borderColor ?? "transparent" }} title={`${c.title} · ${c.start}–${c.end}`}>
                              {c.priority?.important && <span className="mr-0.5 text-[8px]">★</span>}
                              {c.start} {c.title}
                            </div>
                          );
                        })}
                        {dayCommitments.length > 2 && (
                          <div className="text-[8px] text-muted-foreground pl-1">+{dayCommitments.length - 2} mais</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Weekly goal progress rows */}
          <div className="mt-6 grid grid-cols-1 gap-3">
            {weekRows.map((row, idx) => {
              const ws = row.weekStart;
              const we = row.weekEnd;
              const wsStr = ws.toISOString().slice(0, 10);
              const weStr = we.toISOString().slice(0, 10);
              const p = row.goals.reduce((acc, g) => {
                const gp = computeGoalProgress(g, todayIso, data.goals, data.routine, data.commitments);
                acc.weighted += gp.ratio * g.weight;
                acc.totalWeight += g.weight;
                if (gp.denominator > 0 && gp.ratio >= 1) acc.done++;
                return acc;
              }, { weighted: 0, totalWeight: 0, done: 0 });
              const overall = p.totalWeight > 0 ? p.weighted / p.totalWeight : 0;
              return (
                <div key={idx} className="chronos-card p-3 flex items-center gap-4">
                  <div className="text-[10px] text-muted-foreground w-28 shrink-0">
                    {ws.toLocaleDateString(bcp47, { day: "numeric", month: "short" })} – {we.toLocaleDateString(bcp47, { day: "numeric", month: "short" })}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(overall * 100)}%`, backgroundColor: "hsl(var(--secondary))" }} />
                  </div>
                  <span className="text-xs text-primary font-medium num w-8 text-right">{Math.round(overall * 100)}%</span>
                  <span className="text-[10px] text-muted-foreground w-16 text-right">{p.done}/{row.goals.length} metas</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Goal list */}
      <div className="mt-10 border-t border-border/30 pt-5">
        <GoalList
          goals={data.goals}
          commitments={data.commitments}
          routine={data.routine}
          snapshots={data.progressSnapshots}
          categories={data.categories}
          onAddGoal={(fields: GoalFields) => {
            const id = addGoal({ ...fields, kind: fields.kind, tracking: fields.tracking });
            if (fields.autoTrackMode === "commitments") generateGoalCommitments(id);
          }}
          onUpdateGoal={updateGoal}
          onRemoveGoal={removeGoal}
          onToggleBlock={toggleGoalBlock}
          onToggleSubTask={toggleGoalSubTask}
          onAddSubTask={addGoalSubTask}
          onAddBlock={(goalId, duration) => addGoalBlock(goalId, { goalId, title: "", duration: duration ?? 60, date: new Date().toISOString().slice(0, 10), done: true, order: 0 })}
        />
      </div>

      {editItem && (
        <WeekBlockEditDialog
          item={editItem}
          categories={data.categories}
          onClose={() => setEditItem(null)}
          onRemove={() => handleRemove(editItem)}
          onSave={(patch) => handleSave(editItem, patch)}
        />
      )}
    </>
  );
}

function WeekBlockEditDialog({
  item,
  categories,
  onClose,
  onRemove,
  onSave,
}: {
  item: RoutineBlock;
  categories: { id: string; label: string; labelCustom?: string }[];
  onClose: () => void;
  onRemove: () => void;
  onSave: (patch: Partial<RoutineBlock>) => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const [title, setTitle] = useState(item.titleCustom ?? item.title);
  const [kind, setKind] = useState<BlockKind>(item.kind);
  const [day, setDay] = useState<number>(item.day);
  const [start, setStart] = useState(item.start);
  const [end, setEnd] = useState(item.end);
  const [notes, setNotes] = useState(item.notes ?? "");
  const duration = durationMin(start, end);

  function save() {
    if (!title.trim()) return;
    onSave({
      title: item.titleCustom ? item.title : title.trim(),
      titleCustom: item.titleCustom || item.title !== title.trim() ? title.trim() : undefined,
      kind,
      day,
      start,
      end,
      endsNextDay: end <= start,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">{scheduleText.blockTitle(item.title, item.titleCustom)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.title_field}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.kind}</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as BlockKind)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {scheduleText.categoryLabel(category.id as BlockKind, category.label, category.labelCustom)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.day}</Label>
              <Select value={String(day)} onValueChange={(value) => setDay(Number(value))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 0].map((value) => (
                    <SelectItem key={value} value={String(value)}>{t.common.days.long[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.start}</Label>
              <TimeSelect value={start} onValueChange={setStart} bcp47={bcp47} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.end}</Label>
              <TimeSelect value={end} onValueChange={setEnd} bcp47={bcp47} />
            </div>
          </div>
          {duration > 0 && <p className="text-[11px] num text-secondary">{t.chronos.today.duration}: {fmtDur(duration)}</p>}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.notes}</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.chronos.dialog.notesPlaceholder} className="resize-none" />
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />{t.chronos.today.removeBlock}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
            <Button size="sm" onClick={save}>{t.common.save}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
