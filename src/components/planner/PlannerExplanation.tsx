import type { PlannerProposal, PlannerPreferences } from "@/lib/ai/planner/types";
import type { LearningProfile } from "@/lib/ai/learning/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, BarChart3, Brain, ChartBar, Heart, Target } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

interface PlannerExplanationProps {
  proposal: PlannerProposal;
  preferences: PlannerPreferences;
  learningProfile?: LearningProfile;
  onBack: () => void;
}

const WORK_MODE_LABELS: Record<string, { label: string; adaptation: string }> = {
  remote: { label: "Remote", adaptation: "Full flexibility with self-structured focus blocks" },
  hybrid: { label: "Hybrid", adaptation: "Split between office presence and remote flexibility" },
  office: { label: "Office", adaptation: "Fixed schedule with structured work blocks" },
  student: { label: "Student", adaptation: "Class-based scheduling with study blocks" },
  freelance: { label: "Freelance", adaptation: "Flexible blocks aligned with project demands" },
};

const FOCUS_STYLE_LABELS: Record<string, { label: string; structure: string }> = {
  "deep-work": { label: "Deep Work", structure: "Long, uninterrupted focus sessions" },
  balanced: { label: "Balanced", structure: "Mixed focus and varied block lengths" },
  varied: { label: "Varied", structure: "Shorter, diverse blocks throughout the day" },
};

const RECOVERY_LABELS: Record<string, { label: string; frequency: string }> = {
  low: { label: "Low", frequency: "Minimal breaks; maximum schedule density" },
  medium: { label: "Medium", frequency: "Regular breaks between focus blocks" },
  high: { label: "High", frequency: "Frequent recovery periods and buffers" },
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

export default function PlannerExplanation({
  proposal,
  preferences,
  learningProfile,
  onBack,
}: PlannerExplanationProps) {
  const t = useT();
  const dict = t.chronos.plannerPage.explanation;

  const reasons: string[] = [];
  if (proposal.focusRatio > 0.7) reasons.push("This plan prioritizes deep work with long focus blocks.");
  if (proposal.recoveryRatio > 0.3) reasons.push("Recovery is a priority with frequent breaks built in.");
  if (proposal.workload === "intense") reasons.push("Higher block density for ambitious schedules.");
  if (proposal.workload === "light") reasons.push("Lighter schedule with more free time.");

  const totalRatio = proposal.focusRatio + proposal.recoveryRatio;
  const otherRatio = Math.max(0, 1 - totalRatio);

  const recoveryPct = Math.round(proposal.recoveryRatio * 100);

  const workModeInfo = WORK_MODE_LABELS[preferences.workMode] ?? { label: preferences.workMode, adaptation: "Custom adaptation" };
  const focusInfo = FOCUS_STYLE_LABELS[preferences.focusPreference] ?? { label: preferences.focusPreference, structure: "Custom structure" };
  const recoveryInfo = RECOVERY_LABELS[preferences.recoveryPriority] ?? { label: preferences.recoveryPriority, frequency: "Custom balance" };

  const neglectedGoals = learningProfile?.neglectedGoalIds ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-primary">{dict.title}</h1>
        </div>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {dict.back}
        </Button>
      </header>

      {/* Why this plan */}
      <section className="chronos-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-4 w-4 text-secondary shrink-0" />
          <h2 className="font-display text-base text-primary">{dict.whyThisPlan}</h2>
        </div>
        {reasons.length > 0 ? (
          <ul className="space-y-1.5">
            {reasons.map((r, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{dict.noData}</p>
        )}
      </section>

      {/* Workload Distribution */}
      <section className="chronos-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-secondary shrink-0" />
          <h2 className="font-display text-base text-primary">{dict.workloadDist}</h2>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <Stat
            icon={BarChart3}
            label={dict.totalBlocks}
            value={String(proposal.weeklyBlockCount)}
          />
          <Stat
            icon={Target}
            label={dict.focusHours}
            value={`${proposal.estimatedFocusHours}h`}
          />
          <Stat
            icon={Heart}
            label={dict.recoveryHours}
            value={`${proposal.estimatedRecoveryHours}h`}
          />
        </div>

        <div>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted">
            <div
              className="bg-bronze transition-all"
              style={{ width: `${proposal.focusRatio * 100}%` }}
            />
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${proposal.recoveryRatio * 100}%` }}
            />
            {otherRatio > 0 && (
              <div
                className="bg-muted-foreground/20 transition-all"
                style={{ width: `${otherRatio * 100}%` }}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <Legend color="bg-bronze" label={`Focus ${Math.round(proposal.focusRatio * 100)}%`} />
            <Legend color="bg-emerald-500" label={`Recovery ${recoveryPct}%`} />
            <Legend color="bg-muted-foreground/20" label={`Other ${Math.round(otherRatio * 100)}%`} />
          </div>
        </div>
      </section>

      {/* Recovery Allocation */}
      <section className="chronos-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="h-4 w-4 text-secondary shrink-0" />
          <h2 className="font-display text-base text-primary">{dict.recoveryAlloc}</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{dict.recoveryRatio}</span>
            <span className="text-primary font-medium">{recoveryPct}%</span>
          </div>
          <Progress value={recoveryPct} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {recoveryPct}% {dict.recoveryDesc}
          </p>
          <p className="text-sm text-muted-foreground">
            Based on your recovery priority ({recoveryInfo.label}): {recoveryInfo.frequency.toLowerCase()}.
          </p>
        </div>
      </section>

      {/* Goal Alignment */}
      <section className="chronos-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-4 w-4 text-secondary shrink-0" />
          <h2 className="font-display text-base text-primary">{dict.goalAlignment}</h2>
        </div>

        {proposal.preview.goalAlignment.length > 0 ? (
          <div className="space-y-3">
            {proposal.preview.goalAlignment.map((g) => (
              <div key={g.goal}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-primary">{g.goal}</span>
                  <span className="text-muted-foreground">{Math.round(g.match * 100)}%</span>
                </div>
                <Progress value={g.match * 100} className="h-2" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{dict.noData}</p>
        )}

        {neglectedGoals.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm font-medium text-primary mb-2">{dict.neglectedGoals}</p>
            <ul className="space-y-1">
              {neglectedGoals.map((gid) => (
                <li key={gid} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  {gid}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Preference Mapping */}
      <section className="chronos-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ChartBar className="h-4 w-4 text-secondary shrink-0" />
          <h2 className="font-display text-base text-primary">{dict.preferenceMapping}</h2>
        </div>

        <div className="space-y-4">
          <PreferenceRow
            label={dict.workMode}
            value={workModeInfo.label}
            detail={workModeInfo.adaptation}
          />
          <PreferenceRow
            label={dict.focusStyle}
            value={focusInfo.label}
            detail={focusInfo.structure}
          />
          <PreferenceRow
            label={dict.recoveryPriority}
            value={recoveryInfo.label}
            detail={recoveryInfo.frequency}
          />
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">{dict.categories}</span>
              <span className="text-primary font-medium">
                {preferences.weeklyCategories.length} {preferences.weeklyCategories.length === 1 ? "category" : "categories"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preferences.weeklyCategories.length > 0 ? (
                preferences.weeklyCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border border-border"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                    {cat}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
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

function PreferenceRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-sm text-primary font-medium">{value}</p>
      </div>
      <p className="text-xs text-muted-foreground text-right max-w-[240px]">{detail}</p>
    </div>
  );
}
