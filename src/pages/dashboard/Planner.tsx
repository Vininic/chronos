import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Wand2, ArrowLeft } from "lucide-react";
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

type PageState = "builder" | "form" | "proposals" | "merge" | "explain" | "applied";

export default function PlannerPage() {
  const t = useT();
  const { replace } = useSchedule();
  const { profile } = useLearningProfile();
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>("builder");
  const [proposals, setProposals] = useState<PlannerProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<PlannerProposal | null>(null);
  const [lastPrefs, setLastPrefs] = useState<PlannerPreferences | null>(null);

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

  function handleBack() {
    if (state === "proposals") setState("form");
    else if (state === "merge") setState("proposals");
    else if (state === "explain") setState("proposals");
    else if (state === "form") setState("builder");
    else setState("builder");
  }

  if (state === "applied") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <CheckCircle className="h-16 w-16 text-emerald-500 mb-6" />
        <h1 className="font-display text-3xl text-primary mb-2">{t.chronos.plannerPage.applied.title}</h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-md">
          {t.chronos.plannerPage.applied.lead}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {t.chronos.plannerPage.applied.goDashboard}
          </button>
          <button
            onClick={() => setState("builder")}
            className="h-10 px-6 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:text-primary transition-colors"
          >
            {t.chronos.plannerPage.applied.generateAgain}
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
          {t.chronos.plannerPage.builder.back}
        </button>
        <div className="mb-6">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{t.chronos.plannerPage.eyebrow}</div>
          <h1 className="font-display text-3xl text-primary mt-1.5">{t.chronos.plannerPage.title}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.plannerPage.lead}</p>
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
            <div className="text-xs uppercase tracking-[0.22em] text-secondary">{t.chronos.plannerPage.eyebrow}</div>
            <h1 className="font-display text-3xl text-primary -mt-0.5">{t.chronos.plannerPage.title}</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.plannerPage.lead}</p>
      </div>
      <PlannerBuilder
        onApply={handleBuilderApply}
        learningProfile={profile}
      />
    </div>
  );
}
