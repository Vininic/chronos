import type { PlannerProposal } from "@/lib/ai/planner/types";
import type { ScheduleData, RoutineBlock } from "@/lib/schedule/types";
import { useT } from "@/lib/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Layers, Loader2 } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { DAY_LABELS, durationMin } from "@/lib/schedule/types";

interface PlannerMergeProps {
  proposals: PlannerProposal[];
  onApply: (schedule: ScheduleData) => void;
  onBack: () => void;
}

type ViewState = "selection" | "comparison" | "result";

const DAYS = [0, 1, 2, 3, 4, 5, 6];

function getDayBlocks(routine: RoutineBlock[], day: number): RoutineBlock[] {
  return routine.filter((b) => b.day === day);
}

function computeDayStats(blocks: RoutineBlock[]) {
  let focus = 0;
  let recovery = 0;
  let other = 0;
  for (const b of blocks) {
    const mins = durationMin(b.start, b.end);
    if (b.kind === "deep" || b.kind === "shallow") focus += mins;
    else if (b.kind === "recovery") recovery += mins;
    else other += mins;
  }
  return { focus, recovery, other, total: focus + recovery + other };
}

function mergeSelectedProposals(
  proposals: PlannerProposal[],
  decisions: Record<string, string>,
  schedules: ScheduleData[],
): ScheduleData {
  const base = schedules[0];
  const scheduleMap: Record<string, ScheduleData> = {};
  proposals.forEach((p, i) => { scheduleMap[p.id] = schedules[i]; });

  const mergedRoutine: RoutineBlock[] = [];
  const decidedIds = new Set(Object.values(decisions));

  for (const day of DAYS) {
    const chosenId = decisions[String(day)];
    if (chosenId && scheduleMap[chosenId]) {
      const dayBlocks = getDayBlocks(scheduleMap[chosenId].routine, day);
      mergedRoutine.push(...dayBlocks);
    } else {
      const dayBlocks = getDayBlocks(base.routine, day);
      mergedRoutine.push(...dayBlocks);
    }
  }

  const decidedProposalIds = new Set(Object.values(decisions));
  const referenceId = decidedProposalIds.size > 0
    ? proposals.find((p) => decidedProposalIds.has(p.id))?.id ?? proposals[0].id
    : proposals[0].id;
  const reference = scheduleMap[referenceId];

  return {
    ...base,
    meta: { ...base.meta },
    routine: mergedRoutine,
    categories: reference.categories ?? base.categories,
    commitments: reference.commitments ?? base.commitments,
    goals: reference.goals ?? base.goals,
    presets: reference.presets ?? base.presets,
    suggestions: reference.suggestions ?? base.suggestions,
    progressSnapshots: reference.progressSnapshots ?? base.progressSnapshots,
  };
}

export default function PlannerMerge({ proposals, onApply, onBack }: PlannerMergeProps) {
  const t = useT();
  const [view, setView] = useState<ViewState>("selection");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeDecisions, setMergeDecisions] = useState<Record<string, string>>({});
  const [mergedSchedule, setMergedSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);

  const mergeDict = t.chronos.plannerPage.merge;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }, []);

  const selectedProposals = useMemo(
    () => proposals.filter((p) => selectedIds.includes(p.id)),
    [proposals, selectedIds],
  );

  const handleCompare = useCallback(() => {
    if (selectedIds.length < 2) return;
    setView("comparison");
    const initial: Record<string, string> = {};
    DAYS.forEach((d) => { initial[String(d)] = selectedProposals[0].id; });
    setMergeDecisions(initial);
  }, [selectedIds, selectedProposals]);

  const handleDayDecision = useCallback((day: number, proposalId: string) => {
    setMergeDecisions((prev) => ({ ...prev, [String(day)]: proposalId }));
  }, []);

  const handleMerge = useCallback(async () => {
    setLoading(true);
    const schedules = await Promise.all(selectedProposals.map((p) => p.generate()));
    const merged = mergeSelectedProposals(selectedProposals, mergeDecisions, schedules);
    setMergedSchedule(merged);
    setView("result");
    setLoading(false);
  }, [selectedProposals, mergeDecisions]);

  const handleApply = useCallback(() => {
    if (mergedSchedule) onApply(mergedSchedule);
  }, [mergedSchedule, onApply]);

  const comparisonStats = useMemo(() => {
    const result: { day: number; proposalId: string; focus: number; recovery: number; other: number }[][] = [];
    for (const day of DAYS) {
      const row: { day: number; proposalId: string; focus: number; recovery: number; other: number }[] = [];
      for (const proposal of selectedProposals) {
        const bd = proposal.preview.weeklyBreakdown[day];
        row.push({
          day,
          proposalId: proposal.id,
          focus: bd?.focus ?? 0,
          recovery: bd?.recovery ?? 0,
          other: bd?.other ?? 0,
        });
      }
      result.push(row);
    }
    return result;
  }, [selectedProposals]);

  if (view === "selection") {
    return (
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-primary">{mergeDict.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{mergeDict.lead}</p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {mergeDict.back}
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {proposals.map((proposal) => {
            const checked = selectedIds.includes(proposal.id);
            return (
              <button
                key={proposal.id}
                type="button"
                onClick={() => toggleSelection(proposal.id)}
                className={`chronos-card text-left cursor-pointer transition-all ${
                  checked ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-display text-base text-primary">{proposal.name}</h3>
                    <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      checked ? "bg-primary border-primary" : "border-muted-foreground/40"
                    }`}>
                      {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{proposal.description}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {proposal.categoryCount} {t.chronos.plannerPage.proposals.categories}
                    </span>
                    <span>{proposal.estimatedFocusHours}h {t.chronos.plannerPage.proposals.focus.toLowerCase()}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedIds.length >= 2 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <p className="text-sm text-muted-foreground">
              {selectedIds.length < 3 ? mergeDict.selectUpTo3 : ""}
            </p>
            <Button onClick={handleCompare}>
              <Layers className="h-4 w-4 mr-1.5" />
              {mergeDict.compare} ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (view === "comparison") {
    return (
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-primary">{mergeDict.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{mergeDict.lead}</p>
          </div>
          <Button variant="outline" onClick={() => setView("selection")}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {mergeDict.back}
          </Button>
        </header>

        <div className="chronos-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider w-24">
                    {mergeDict.day}
                  </th>
                  {selectedProposals.map((p) => (
                    <th key={p.id} className="p-3 text-left font-display text-primary min-w-[180px]">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, dayIndex) => {
                  const dayLabel = DAY_LABELS[day];
                  const rowStats = comparisonStats[dayIndex];
                  return (
                    <tr key={day} className="border-b border-border last:border-b-0">
                      <td className="p-3 text-muted-foreground font-medium align-top">
                        {dayLabel}
                      </td>
                      {selectedProposals.map((proposal, propIndex) => {
                        const decKey = String(day);
                        const isSelected = mergeDecisions[decKey] === proposal.id;
                        const stats = rowStats[propIndex];
                        const total = stats.focus + stats.recovery + stats.other;
                        const focusPct = total > 0 ? (stats.focus / total) * 100 : 0;
                        const recoveryPct = total > 0 ? (stats.recovery / total) * 100 : 0;
                        const otherPct = total > 0 ? (stats.other / total) * 100 : 0;

                        return (
                          <td key={proposal.id} className={`p-3 align-top ${isSelected ? "bg-primary/5" : ""}`}>
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`day-${day}`}
                                  checked={isSelected}
                                  onChange={() => handleDayDecision(day, proposal.id)}
                                  className="accent-primary"
                                />
                                <span className="text-xs text-muted-foreground">{mergeDict.useThisDay}</span>
                              </label>

                              <div className="flex h-6 rounded-sm overflow-hidden">
                                {focusPct > 0 && (
                                  <div className="bg-bronze/80" style={{ width: `${focusPct}%` }} title="Focus" />
                                )}
                                {recoveryPct > 0 && (
                                  <div className="bg-emerald-500/60" style={{ width: `${recoveryPct}%` }} title="Recovery" />
                                )}
                                {otherPct > 0 && (
                                  <div className="bg-muted-foreground/20" style={{ width: `${otherPct}%` }} title="Other" />
                                )}
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{Math.round(stats.focus / 60)}h</span>
                                <span>{Math.round(stats.recovery / 60)}h</span>
                                <span>{Math.round(stats.other / 60)}h</span>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center">
          <Button size="lg" onClick={handleMerge} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Layers className="h-4 w-4 mr-1.5" />
            )}
            {mergeDict.compare}
          </Button>
        </div>
      </div>
    );
  }

  if (view === "result" && mergedSchedule) {
    const usedDays: { day: number; sourceName: string }[] = DAYS.map((day) => {
      const decKey = String(day);
      const chosenId = mergeDecisions[decKey];
      const source = proposals.find((p) => p.id === chosenId);
      return { day, sourceName: source?.name ?? selectedProposals[0].name };
    });

    return (
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-primary">{mergeDict.mergedResult}</h1>
          <p className="text-sm text-muted-foreground mt-1">{mergeDict.lead}</p>
        </header>

        <div className="chronos-card p-6">
          <h3 className="font-display text-lg text-primary mb-4">{t.chronos.plannerPage.proposals.weeklyRhythm}</h3>
          <div className="grid grid-cols-7 gap-2 mb-6">
            {DAYS.map((day) => {
              const dayLabel = DAY_LABELS[day];
              const dayBlocks = getDayBlocks(mergedSchedule.routine, day);
              const stats = computeDayStats(dayBlocks);
              const total = stats.total || 1;
              const focusPct = (stats.focus / total) * 100;
              const recoveryPct = (stats.recovery / total) * 100;
              const otherPct = (stats.other / total) * 100;
              const usedDay = usedDays.find((d) => d.day === day);

              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{dayLabel}</span>
                  <div className="w-full h-24 rounded-sm overflow-hidden flex flex-col-reverse bg-muted/30">
                    {otherPct > 0 && <div className="w-full bg-muted-foreground/20" style={{ height: `${otherPct}%` }} />}
                    {recoveryPct > 0 && <div className="w-full bg-emerald-500/60" style={{ height: `${recoveryPct}%` }} />}
                    {focusPct > 0 && <div className="w-full bg-bronze/80" style={{ height: `${focusPct}%` }} />}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{Math.round(stats.total / 60)}h</span>
                  {usedDay && (
                    <span className="text-[9px] text-muted-foreground text-center leading-tight" title={usedDay.sourceName}>
                      {usedDay.sourceName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium text-primary mb-2">{mergeDict.day} — {t.chronos.plannerPage.proposals.focus}</h4>
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
              {DAYS.map((day) => {
                const dayBlocks = getDayBlocks(mergedSchedule.routine, day);
                const stats = computeDayStats(dayBlocks);
                return (
                  <div key={day}>
                    <span className="block">{Math.round(stats.focus / 60)}h</span>
                    <span className="block text-[10px]">{Math.round(stats.recovery / 60)}h {t.chronos.plannerPage.proposals.recovery.toLowerCase()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {mergeDict.back}
          </Button>
          <Button onClick={handleApply}>
            <Check className="h-4 w-4 mr-1.5" />
            {mergeDict.applyMerged}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
