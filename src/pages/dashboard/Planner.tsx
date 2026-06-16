import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Wand2, ArrowLeft, Trash2, Plus, Eye } from "lucide-react";
import PlannerForm from "@/components/planner/PlannerForm";
import PlannerProposals from "@/components/planner/PlannerProposals";
import PlannerBuilder from "@/components/planner/PlannerBuilder";
import PlannerMerge from "@/components/planner/PlannerMerge";
import PlannerExplanation from "@/components/planner/PlannerExplanation";
import { generateProposals } from "@/lib/ai/planner/generator";
import { useSchedule } from "@/lib/schedule/store";
import { useLearningProfile } from "@/lib/ai/learning/store";
import type { PlannerPreferences, PlannerProposal } from "@/lib/ai/planner/types";
import type { ScheduleData } from "@/lib/schedule/types";
import { useT } from "@/lib/i18n/I18nProvider";

type PageState = "builder" | "form" | "proposals" | "merge" | "explain" | "applied" | "dashboard";

export default function PlannerPage() {
  const t = useT();
  const { data, replace, resetToSeed } = useSchedule();
  const { profile } = useLearningProfile();
  const navigate = useNavigate();
  const hasPlan = useMemo(() => data.categories.length > 0 && data.routine.length > 0, [data]);
  const [state, setState] = useState<PageState>(hasPlan ? "dashboard" : "builder");
  const [proposals, setProposals] = useState<PlannerProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<PlannerProposal | null>(null);
  const [lastPrefs, setLastPrefs] = useState<PlannerPreferences | null>(null);
  const pp = t.chronos.plannerPage;

  useEffect(() => {
    if (hasPlan && (state === "builder" || state === "form")) setState("dashboard");
  }, [hasPlan, state]);

  function handleBuilderApply(schedule: ScheduleData) {
    replace(schedule);
    setState("applied");
  }

  function handleSubmit(prefs: PlannerPreferences) {
    setLastPrefs(prefs);
    const generated = generateProposals(prefs, profile);
    setProposals(generated);
    setState("proposals");
  }

  async function handleSelect(proposal: PlannerProposal) {
    const schedule = await proposal.generate();
    replace(schedule);
    setState("applied");
  }

  async function handleMergeApply(schedule: ScheduleData) {
    replace(schedule);
    setState("applied");
  }

  function handleExplain(proposal: PlannerProposal) {
    setSelectedProposal(proposal);
    setState("explain");
  }

  function handleMergeMode() {
    setState("merge");
  }

  function handleDeletePlan() {
    resetToSeed();
    setState("builder");
  }

  function handleBack() {
    if (state === "proposals") setState("form");
    else if (state === "merge") setState("proposals");
    else if (state === "explain") setState("proposals");
    else if (state === "form") setState("builder");
    else if (state === "dashboard") setState("builder");
    else setState("builder");
  }

  if (state === "dashboard") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 text-center">
          <div className="h-10 w-10 rounded-lg bg-primary grid place-items-center mx-auto mb-3">
            <Wand2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl text-primary">{pp.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{pp.lead}</p>
        </div>

        <div className="chronos-card p-6 mb-6">
          <h2 className="font-display text-lg text-primary mb-2">{pp.currentPlan}</h2>
          <p className="text-sm text-muted-foreground mb-4">{pp.currentPlanDesc}</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border/60">
              <span className="text-primary font-medium">{data.categories.length}</span>
              <span className="text-muted-foreground ml-1.5">{pp.builder.categories.toLowerCase()}</span>
            </div>
            <div className="p-3 rounded-lg border border-border/60">
              <span className="text-primary font-medium">{Math.round(data.ledger.scheduledHours.reduce((a, b) => a + b, 0))}h</span>
              <span className="text-muted-foreground ml-1.5">{pp.builder.weeklyBlocks.toLowerCase()}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="chronos-card p-5 text-left hover:border-secondary/50 transition-colors border-2 border-border"
          >
            <Eye className="h-6 w-6 text-secondary mb-2" />
            <div className="text-sm font-medium text-primary">{pp.viewPlan}</div>
            <div className="text-xs text-muted-foreground mt-1">{pp.viewPlanDesc}</div>
          </button>
          <button
            onClick={() => setState("builder")}
            className="chronos-card p-5 text-left hover:border-secondary/50 transition-colors border-2 border-border"
          >
            <Plus className="h-6 w-6 text-secondary mb-2" />
            <div className="text-sm font-medium text-primary">{pp.newPlan}</div>
            <div className="text-xs text-muted-foreground mt-1">{pp.newPlanDesc}</div>
          </button>
          <button
            onClick={handleDeletePlan}
            className="chronos-card p-5 text-left hover:border-destructive/50 transition-colors border-2 border-border"
          >
            <Trash2 className="h-6 w-6 text-destructive mb-2" />
            <div className="text-sm font-medium text-primary">{pp.deletePlan}</div>
            <div className="text-xs text-muted-foreground mt-1">{pp.deletePlanDesc}</div>
          </button>
        </div>
      </div>
    );
  }

  if (state === "applied") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle className="h-16 w-16 text-emerald-500 mb-6" />
        <h1 className="font-display text-3xl text-primary mb-2">{pp.applied.title}</h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-md">
          {pp.applied.lead}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {pp.applied.goDashboard}
          </button>
          <button
            onClick={() => setState("builder")}
            className="h-10 px-6 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:text-primary transition-colors"
          >
            {pp.applied.generateAgain}
          </button>
        </div>
      </div>
    );
  }

  if (state === "explain" && selectedProposal && lastPrefs) {
    return (
      <PlannerExplanation
        proposal={selectedProposal}
        preferences={lastPrefs}
        learningProfile={profile}
        onBack={handleBack}
      />
    );
  }

  if (state === "merge") {
    return (
      <PlannerMerge
        proposals={proposals}
        onApply={handleMergeApply}
        onBack={handleBack}
      />
    );
  }

  if (state === "proposals") {
    return (
      <PlannerProposals
        proposals={proposals}
        onSelect={handleSelect}
        onBack={handleBack}
        onExplain={handleExplain}
        onMerge={handleMergeMode}
      />
    );
  }

  if (state === "form") {
    return (
      <div>
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {pp.builder.back}
        </button>
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{pp.eyebrow}</div>
          <h1 className="font-display text-3xl text-primary mt-1.5">{pp.title}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{pp.lead}</p>
        </div>
        <PlannerForm onSubmit={handleSubmit} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-primary grid place-items-center">
            <Wand2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-secondary">{pp.eyebrow}</div>
            <h1 className="font-display text-3xl text-primary -mt-0.5">{pp.title}</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{pp.lead}</p>
      </div>
      <PlannerBuilder
        onApply={handleBuilderApply}
        learningProfile={profile}
      />
    </div>
  );
}
