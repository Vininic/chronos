import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import PlannerForm from "@/components/planner/PlannerForm";
import PlannerProposals from "@/components/planner/PlannerProposals";
import { generateProposals } from "@/lib/ai/planner/generator";
import { useSchedule } from "@/lib/schedule/store";
import type { PlannerPreferences, PlannerProposal } from "@/lib/ai/planner/types";
import { useT } from "@/lib/i18n/I18nProvider";

type PageState = "form" | "proposals" | "applied";

export default function PlannerPage() {
  const t = useT();
  const { replace } = useSchedule();
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>("form");
  const [proposals, setProposals] = useState<PlannerProposal[]>([]);

  function handleSubmit(prefs: PlannerPreferences) {
    const generated = generateProposals(prefs);
    setProposals(generated);
    setState("proposals");
  }

  async function handleSelect(proposal: PlannerProposal) {
    const schedule = await proposal.generate();
    replace(schedule);
    setState("applied");
  }

  function handleBack() {
    setState("form");
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
            onClick={handleBack}
            className="h-10 px-6 rounded-lg border border-border text-muted-foreground text-sm font-medium hover:text-primary transition-colors"
          >
            {t.chronos.plannerPage.applied.generateAgain}
          </button>
        </div>
      </div>
    );
  }

  if (state === "proposals") {
    return (
      <PlannerProposals
        proposals={proposals}
        onSelect={handleSelect}
        onBack={handleBack}
      />
    );
  }

  return <PlannerForm onSubmit={handleSubmit} />;
}
