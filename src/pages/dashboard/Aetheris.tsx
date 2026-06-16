import { useState, useEffect, useCallback } from "react";
import type { FunctionComponent, SVGProps } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { useSchedule } from "@/lib/schedule/store";
import { runAetherisPipeline, type AetherisPipelineResult } from "@/lib/ai/core/pipeline";
import type { Insight, Suggestion, RecoveryAnalysis } from "@/lib/ai/core/schemas";
import type { OptimizationResult } from "@/lib/ai/optimization/optimizationEngine";
import { Sparkles, Brain, Target, Coffee, AlertTriangle, Check, ChevronDown, ChevronUp, Loader2, MessageSquare, Send, BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { ScheduleData } from "@/lib/schedule/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import PlannerBuilder from "@/components/planner/PlannerBuilder";
import LearningInsights from "@/components/planner/LearningInsights";
import { useLearningProfile } from "@/lib/ai/learning/store";

type TabView = "insights" | "suggestions" | "recovery" | "optimize" | "planner" | "learning";
type LucideIcon = FunctionComponent<SVGProps<SVGSVGElement>>;

export default function Aetheris() {
  const { data, replace, applySuggestion, deferSuggestion } = useSchedule();
  const { profile } = useLearningProfile();
  const t = useT();
  const scheduleText = useScheduleText();
  const [tab, setTab] = useState<TabView>("insights");
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<AetherisPipelineResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [askInput, setAskInput] = useState("");

  const runPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const result = await runAetherisPipeline({ data });
      setPipeline(result);
    } catch {
      setPipeline(null);
    } finally {
      setLoading(false);
    }
  }, [data.meta.version, data.routine.length, data.commitments.length, data.categories.length]);

  useEffect(() => {
    runPipeline();
  }, [runPipeline]);

  const { insights = [], summary = { status: "unknown" as const, headline: "", keyMetrics: {} }, explainability = { reasoning: [], affectedGoals: [], affectedBlocks: [], affectedMetrics: [], expectedImpact: "", confidence: 0 } } = pipeline?.response ?? {};
  const suggestions = pipeline?.suggestions ?? [];
  const optimization = pipeline?.optimization ?? { conflicts: [], idleGaps: [], focusFragmentation: 0, routineConsistency: 0, timeAllocation: [], compositionScore: 0, scheduledHours: [] };
  const recoveryIntel = pipeline?.recoveryIntelligence ?? { recoveryScore: 0, sustainableScore: 0, recommendations: [] };

  const recoveryCount = insights.filter((i) =>
    ["overload", "burnout_risk", "sleep_debt", "context_switching", "consecutive_work"].includes(i.type),
  ).length;

  const tabs: { key: TabView; label: string; icon: LucideIcon; count: number }[] = [
    { key: "insights", label: "Insights", icon: Brain, count: insights.length },
    { key: "suggestions", label: "Suggestions", icon: Sparkles, count: suggestions.length },
    { key: "recovery", label: "Recovery", icon: Coffee, count: recoveryCount },
    { key: "optimize", label: "Optimize", icon: Target, count: optimization.conflicts.length + optimization.idleGaps.length },
    { key: "planner", label: "Planner", icon: BarChart3, count: 0 },
    { key: "learning", label: "Learning", icon: MessageSquare, count: 0 },
  ];

  if (loading) {
    return (
      <div className="grid place-items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-secondary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">{t.chronos.aetheris.loading ?? "Analyzing schedule..."}</p>
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="grid place-items-center min-h-[60vh]">
        <div className="text-center">
          <Brain className="h-8 w-8 text-secondary mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Could not load analysis.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.aetheris.eyebrow}</div>
            <h1 className="font-display text-3xl text-primary mt-1">{t.chronos.aetheris.title}</h1>
          </div>
          <span className={`text-[11px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border ${
            summary.status === "healthy" ? "text-emerald-600 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30" :
            summary.status === "critical" ? "text-red-600 border-red-300 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950/30" :
            "text-amber-600 border-amber-300 bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:bg-amber-950/30"
          }`}>
            {summary.status}
          </span>
        </div>
      </header>

      {/* Ask Aetheris */}
      <div className="chronos-card p-4 mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-secondary shrink-0" />
          <input
            type="text"
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && askInput.trim()) {
                toast({ title: "Aetheris chat coming in Phase 14" });
                setAskInput("");
              }
            }}
            placeholder="Ask Aetheris about your schedule..."
            className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <button
            onClick={() => {
              if (askInput.trim()) {
                toast({ title: "Aetheris chat coming in Phase 14" });
                setAskInput("");
              }
            }}
            disabled={!askInput.trim()}
            className="h-8 w-8 rounded-md bg-primary grid place-items-center text-primary-foreground disabled:opacity-30"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map((tabDef) => (
          <button
            key={tabDef.key}
            onClick={() => setTab(tabDef.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium uppercase tracking-wider border-b-2 transition-colors shrink-0 ${
              tab === tabDef.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-primary"
            }`}
          >
            <tabDef.icon className="h-3.5 w-3.5" />
            {tabDef.label}
            {tabDef.count > 0 && (
              <span className="ml-1 text-[10px] bg-secondary/20 text-secondary px-1.5 py-0.5 rounded-full">{tabDef.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Summary card for analysis tabs */}
      {(tab === "insights" || tab === "suggestions" || tab === "recovery" || tab === "optimize") && (
        <div className="chronos-card p-4 mb-6">
          <p className="text-sm text-primary font-medium">{summary.headline}</p>
          {Object.keys(summary.keyMetrics).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-6 text-sm">
              {Object.entries(summary.keyMetrics).map(([k, v]) => (
                <div key={k}>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.replace(/([A-Z])/g, " $1").trim()}</span>
                  <div className="font-display text-xl text-primary mt-0.5 num">{String(v)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab panels */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {tab === "insights" && <InsightsPanel insights={insights} expanded={expandedInsight} onToggle={setExpandedInsight} />}
          {tab === "suggestions" && <SuggestionsPanel suggestions={suggestions} onApply={applySuggestion} onDefer={deferSuggestion} t={t} />}
          {tab === "recovery" && <RecoveryPanel recoveryIntel={recoveryIntel} />}
          {tab === "optimize" && <OptimizePanel optimization={optimization} data={data} />}
          {tab === "planner" && (
            <PlannerBuilder onApply={(schedule) => { replace(schedule); toast({ title: "Plan applied!" }); }} />
          )}
          {tab === "learning" && <LearningInsights profile={profile} />}

          {(tab === "insights" || tab === "suggestions" || tab === "recovery" || tab === "optimize") && (
            <ExplainabilityCard explainability={explainability} />
          )}
        </div>

        <div className="space-y-6">
          {(tab === "insights" || tab === "suggestions" || tab === "recovery" || tab === "optimize") && (
            <>
              <ContextCard data={data} scheduleText={scheduleText} t={t} pipeline={pipeline} />
              <RuleCheckCard pipeline={pipeline} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InsightsPanel({ insights, expanded, onToggle }: {
  insights: Insight[];
  expanded: string | null;
  onToggle: (id: string | null) => void;
}) {
  if (insights.length === 0) {
    return (
      <div className="chronos-card p-8 text-center">
        <Brain className="h-8 w-8 text-secondary mx-auto" />
        <p className="mt-3 text-sm text-muted-foreground">No issues detected — your schedule looks healthy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((ins, i) => {
        const id = `${ins.type}-${i}`;
        const isOpen = expanded === id;
        return (
          <div key={id} className={`chronos-card overflow-hidden ${ins.severity === "critical" ? "border-red-300/50 dark:border-red-800/50" : ins.severity === "warning" ? "border-amber-300/50 dark:border-amber-800/50" : ""}`}>
            <button
              onClick={() => onToggle(isOpen ? null : id)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-2 w-2 rounded-full shrink-0 ${
                  ins.severity === "critical" ? "bg-red-500" :
                  ins.severity === "warning" ? "bg-amber-500" : "bg-sky-500"
                }`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary truncate">{ins.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{ins.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground">{Math.round(ins.confidence * 100)}%</span>
                {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-secondary" /> : <ChevronDown className="h-3.5 w-3.5 text-secondary" />}
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-0 border-t border-border/60">
                <p className="text-sm text-muted-foreground mt-3">{ins.detail}</p>
                {ins.suggestion && (
                  <div className="mt-2 flex items-start gap-2 text-sm">
                    <Sparkles className="h-3.5 w-3.5 text-secondary mt-0.5 shrink-0" />
                    <span className="text-secondary">{ins.suggestion}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SuggestionsPanel({ suggestions, onApply, onDefer, t }: {
  suggestions: Suggestion[];
  onApply: (id: string) => void;
  onDefer: (id: string) => void;
  t: Dictionary;
}) {
  if (suggestions.length === 0) {
    return (
      <div className="chronos-card p-8 text-center">
        <Sparkles className="h-8 w-8 text-secondary mx-auto" />
        <p className="mt-3 text-sm text-muted-foreground italic">{t.chronos.aetheris.allQuietLead}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <div key={s.id} className="chronos-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-primary">{s.title}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.detail}</p>
            </div>
            <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded ${
              s.priority === "high" ? "bg-secondary text-primary-deep" :
              s.priority === "medium" ? "bg-secondary/20 text-secondary" : "bg-muted text-muted-foreground"
            }`}>{s.priority}</span>
          </div>
          {s.actionable && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => { onApply(s.id); toast({ title: t.chronos.aetheris.applied }); }}
                className="text-xs h-7 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary-deep inline-flex items-center gap-1.5"
              >
                <Check className="h-3 w-3" /> Apply
              </button>
              <button
                onClick={() => { onDefer(s.id); toast({ title: t.chronos.aetheris.deferred }); }}
                className="text-xs h-7 px-3 rounded-md border border-border hover:bg-secondary/10 text-muted-foreground inline-flex items-center gap-1.5"
              >
                Defer
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RecoveryPanel({ recoveryIntel }: { recoveryIntel: RecoveryAnalysis }) {
  return (
    <div className="chronos-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Coffee className="h-5 w-5 text-emerald-500" />
        <h3 className="font-display text-lg text-primary">Recovery Intelligence</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recovery Score</div>
          <div className="font-display text-2xl text-primary mt-1 num">{recoveryIntel.recoveryScore}/100</div>
        </div>
        <div className="border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sustainability</div>
          <div className="font-display text-2xl text-primary mt-1 num">{recoveryIntel.sustainableScore}/100</div>
        </div>
      </div>
      {recoveryIntel.recommendations.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-primary">Recommendations</div>
          {recoveryIntel.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OptimizePanel({ optimization, data }: { optimization: OptimizationResult; data: ScheduleData }) {
  return (
    <div className="chronos-card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <Target className="h-5 w-5 text-violet-500" />
        <h3 className="font-display text-lg text-primary">Schedule Optimization</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Conflicts</div>
          <div className="font-display text-xl text-primary mt-0.5 num">{optimization.conflicts.length}</div>
        </div>
        <div className="border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Idle Gaps</div>
          <div className="font-display text-xl text-primary mt-0.5 num">{optimization.idleGaps.length}</div>
        </div>
        <div className="border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fragmentation</div>
          <div className="font-display text-xl text-primary mt-0.5 num">{Math.round(optimization.focusFragmentation * 100)}%</div>
        </div>
        <div className="border border-border rounded-lg p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Consistency</div>
          <div className="font-display text-xl text-primary mt-0.5 num">{Math.round(optimization.routineConsistency * 100)}%</div>
        </div>
      </div>
    </div>
  );
}

function ExplainabilityCard({ explainability }: { explainability: {
  reasoning: string[];
  affectedGoals: string[];
  affectedBlocks: string[];
  affectedMetrics: string[];
  expectedImpact: string;
  confidence: number;
} }) {
  if (!explainability || explainability.reasoning.length === 0) return null;
  return (
    <div className="chronos-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-secondary" />
        <h3 className="text-xs font-medium uppercase tracking-wider text-secondary">Explainability</h3>
      </div>
      <ul className="space-y-1.5">
        {explainability.reasoning.slice(0, 5).map((r: string, i: number) => (
          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
            <span className="mt-1 h-1 w-1 rounded-full bg-secondary/40 shrink-0" />
            {r}
          </li>
        ))}
      </ul>
      {explainability.affectedGoals.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Affected goals: {explainability.affectedGoals.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

function ContextCard({ data, scheduleText, t, pipeline }: { data: ScheduleData; scheduleText: ReturnType<typeof useScheduleText>; t: Dictionary; pipeline: AetherisPipelineResult }) {
  return (
    <div className="chronos-card p-5">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-md bg-primary grid place-items-center">
          <Sparkles className="h-4 w-4 text-secondary-soft" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.aetheris.contextEyebrow}</div>
          <h3 className="font-display text-xl text-primary -mt-0.5">{t.chronos.aetheris.contextTitle}</h3>
        </div>
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        {[
          [t.chronos.aetheris.ctxRoutine, data.routine.length],
          [t.chronos.aetheris.ctxCommitments, data.commitments.length],
          [t.chronos.aetheris.ctxCategories, data.categories.length],
          [t.chronos.aetheris.ctxScore, `${data.ledger.compositionScore} / 100`],
          [t.chronos.aetheris.ctxCycle, scheduleText.cycleName(data.meta.cycle.name)],
          ["Token est.", `${pipeline.contextTokenEstimate} tokens`],
          ["Rules", `${pipeline.ruleCheckSummary.passed}/${pipeline.ruleCheckSummary.total} passed`],
        ].map(([l, v]) => (
          <div key={l as string} className="flex items-center justify-between border-b border-border/60 pb-2">
            <dt className="text-muted-foreground">{l}</dt>
            <dd className="text-primary font-medium num">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-muted-foreground italic leading-relaxed">{t.chronos.aetheris.contextNote}</p>
    </div>
  );
}

function RuleCheckCard({ pipeline }: { pipeline: AetherisPipelineResult }) {
  const { ruleCheckSummary } = pipeline;
  return (
    <div className="chronos-card p-5">
      <h3 className="text-[11px] uppercase tracking-[0.22em] text-secondary">Understanding Rules</h3>
      <div className="mt-3 space-y-2">
        {ruleCheckSummary.failing.length > 0 && (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            {ruleCheckSummary.failing.length} rule(s) not passed
          </div>
        )}
        {ruleCheckSummary.failing.map((rule: string) => (
          <div key={rule} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            {rule}
          </div>
        ))}
        <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
          {ruleCheckSummary.passed}/{ruleCheckSummary.total} rules passing
        </div>
      </div>
    </div>
  );
}
