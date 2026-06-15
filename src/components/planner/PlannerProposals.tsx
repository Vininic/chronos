import type { PlannerProposal } from "@/lib/ai/planner/types";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Clock, Layers, Target, Activity } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

interface Props {
  proposals: PlannerProposal[];
  onSelect: (proposal: PlannerProposal) => void;
  onBack: () => void;
  onExplain?: (proposal: PlannerProposal) => void;
  onMerge?: () => void;
}

const WORKLOAD_COLORS: Record<string, string> = {
  light: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  moderate: "text-amber-500 border-amber-500/30 bg-amber-500/10",
  intense: "text-red-500 border-red-500/30 bg-red-500/10",
};

const CATEGORY_COLORS: Record<string, string> = {
  bronze: "bg-bronze",
  emerald: "bg-emerald-500",
  neutral: "bg-muted-foreground/30",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  lime: "bg-lime-500",
  peach: "bg-orange-300",
  slate: "bg-slate-500",
  amber: "bg-amber-500",
  mint: "bg-teal-400",
  coral: "bg-rose-400",
  "primary-glow": "bg-secondary",
  indigo: "bg-indigo-500",
};

export default function PlannerProposals({ proposals, onSelect, onBack, onExplain, onMerge }: Props) {
  const t = useT();
  if (proposals.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t.chronos.plannerPage.proposals.empty}</p>
        <Button variant="outline" className="mt-4" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {t.chronos.plannerPage.proposals.adjustPrefs}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-primary">{t.chronos.plannerPage.proposals.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.chronos.plannerPage.proposals.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {proposals.length >= 2 && onMerge && (
            <Button variant="outline" onClick={onMerge}>
              <Layers className="h-4 w-4 mr-1.5" />
              {t.chronos.plannerPage.merge.compare}
            </Button>
          )}
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {t.chronos.plannerPage.proposals.adjustPrefs}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {proposals.map((proposal) => (
          <div key={proposal.id} className="chronos-card flex flex-col">
            <div className="p-5 pb-0">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg text-primary">{proposal.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{proposal.description}</p>
                </div>
                <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${WORKLOAD_COLORS[proposal.workload]}`}>
                  {proposal.workload}
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{t.chronos.plannerPage.proposals.focus}</span>
                  <span>{Math.round(proposal.focusRatio * 100)}%</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                  <div
                    className="bg-bronze transition-all"
                    style={{ width: `${proposal.focusRatio * 100}%` }}
                  />
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${proposal.recoveryRatio * 100}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>{t.chronos.plannerPage.proposals.recovery}</span>
                  <span>{Math.round(proposal.recoveryRatio * 100)}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Stat icon={Layers} label={t.chronos.plannerPage.proposals.categories} value={String(proposal.categoryCount)} />
                <Stat icon={Activity} label={t.chronos.plannerPage.proposals.weeklyBlocks} value={String(proposal.weeklyBlockCount)} />
                <Stat icon={Clock} label={t.chronos.plannerPage.proposals.focusHours} value={`${proposal.estimatedFocusHours}h`} />
                <Stat icon={Target} label={t.chronos.plannerPage.proposals.recoveryHours} value={`${proposal.estimatedRecoveryHours}h`} />
              </div>

              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{t.chronos.plannerPage.proposals.weeklyRhythm}</div>
                <div className="flex items-end gap-1 h-16">
                  {proposal.preview.weeklyBreakdown.map((day) => {
                    const total = day.focus + day.recovery + day.other;
                    const focusH = total > 0 ? (day.focus / total) * 100 : 0;
                    const recoveryH = total > 0 ? (day.recovery / total) * 100 : 0;
                    const maxBar = Math.max(...proposal.preview.weeklyBreakdown.map((d) => d.focus + d.recovery + d.other));
                    const barH = maxBar > 0 ? (total / maxBar) * 100 : 0;
                    return (
                      <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t-sm overflow-hidden" style={{ height: `${Math.max(barH, 4)}%` }}>
                          {total > 0 && (
                            <div className="h-full w-full flex flex-col-reverse">
                              <div style={{ height: `${(day.other / total) * 100}%` }} className="w-full bg-muted-foreground/20" />
                              <div style={{ height: `${(day.recovery / total) * 100}%` }} className="w-full bg-emerald-500/60" />
                              <div style={{ height: `${(day.focus / total) * 100}%` }} className="w-full bg-bronze/80" />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{day.day}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Legend color="bg-bronze/80" label={t.chronos.plannerPage.proposals.focus} />
                  <Legend color="bg-emerald-500/60" label={t.chronos.plannerPage.proposals.recovery} />
                  <Legend color="bg-muted-foreground/20" label="Other" />
                </div>
              </div>

              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{t.chronos.plannerPage.proposals.categories}</div>
                <div className="flex flex-wrap gap-1.5">
                  {proposal.preview.categoryDistribution.map((cat) => (
                    <span
                      key={cat.name}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border border-border"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLORS[cat.color] ?? "bg-muted-foreground"}`} />
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto p-5 pt-0 flex gap-2">
              {onExplain && (
                <Button variant="outline" className="flex-1 text-xs" onClick={() => onExplain(proposal)}>
                  {t.chronos.plannerPage.proposals.explain}
                </Button>
              )}
              <Button className="flex-1" onClick={() => onSelect(proposal)}>
                <Check className="h-4 w-4 mr-1.5" />
                {t.chronos.plannerPage.proposals.selectPlan}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-border/60">
      <Icon className="h-3.5 w-3.5 text-secondary shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm text-primary font-medium num">{value}</div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
