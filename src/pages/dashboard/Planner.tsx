import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Wand2, ArrowLeft, Trash2, Plus, MessageSquare, AlertTriangle, X } from "lucide-react";
import PlannerForm from "@/components/planner/PlannerForm";
import PlannerProposals from "@/components/planner/PlannerProposals";
import PlannerBuilder from "@/components/planner/PlannerBuilder";
import PlannerMerge from "@/components/planner/PlannerMerge";
import PlannerExplanation from "@/components/planner/PlannerExplanation";
import { generateProposals } from "@/lib/ai/planner/generator";
import { useSchedule } from "@/lib/schedule/store";
import { useLearningProfile } from "@/lib/ai/learning/store";
import { useChatStore } from "@/lib/ai/chat/store";
import { safeKindStyle, TAILWIND_TO_HEX } from "@/components/dashboard/widgets";
import type { PlannerPreferences, PlannerProposal } from "@/lib/ai/planner/types";
import type { ScheduleData } from "@/lib/schedule/types";
import { useT, useI18n } from "@/lib/i18n/I18nProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type PageState = "builder" | "form" | "proposals" | "merge" | "explain" | "applied" | "dashboard" | "empty";

export default function PlannerPage() {
  const t = useT();
  const { locale } = useI18n();
  const { data, replace, resetToSeed } = useSchedule();
  const { profile } = useLearningProfile();
  const { createSession } = useChatStore();
  const navigate = useNavigate();
  const hasPlan = useMemo(() => data.categories.length > 0 && data.routine.length > 0, [data]);
  const [state, setState] = useState<PageState>(hasPlan ? "dashboard" : "builder");
  const [proposals, setProposals] = useState<PlannerProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<PlannerProposal | null>(null);
  const [lastPrefs, setLastPrefs] = useState<PlannerPreferences | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const pp = t.chronos.plannerPage;

  const dayLabels = locale === "pt"
    ? ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const blocksByDay = useMemo(() => {
    const byDay: { day: number; blocks: typeof data.routine }[] = [];
    for (let d = 0; d < 7; d++) {
      byDay.push({ day: d, blocks: data.routine.filter((b) => b.day === d) });
    }
    return byDay;
  }, [data.routine]);

  const categoryBlocks = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of data.routine) {
      counts[b.kind] = (counts[b.kind] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [data.routine]);

  const totalWeeklyMin = useMemo(() => {
    let total = 0;
    for (const b of data.routine) {
      const [sh, sm] = b.start.split(":").map(Number);
      const [eh, em] = b.end.split(":").map(Number);
      total += (eh * 60 + em) - (sh * 60 + sm);
    }
    return total;
  }, [data.routine]);

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
    setConfirmDelete(false);
    setState("empty");
  }

  function handleChatAbout() {
    createSession("Active Plan");
    navigate("/dashboard/aetheris");
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
    const totalH = Math.round(totalWeeklyMin / 60);
    const focusMin = data.routine.filter((b) => (data.meta.focusCategoryIds ?? []).includes(b.kind)).length * 60;
    const focusPct = totalWeeklyMin > 0 ? Math.round((focusMin / totalWeeklyMin) * 100) : 0;
    return (
      <>
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 text-center">
            <div className="h-10 w-10 rounded-lg bg-primary grid place-items-center mx-auto mb-3">
              <Wand2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="font-display text-3xl text-primary">{pp.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{pp.lead}</p>
          </div>

          {/* Schedule preview */}
          <div className="chronos-card p-6 mb-6">
            <h2 className="font-display text-lg text-primary mb-4">{pp.currentPlan}</h2>

            {/* Day-by-day block preview */}
            <div className="space-y-1.5 mb-5">
              {blocksByDay.map(({ day, blocks }) => (
                <div key={day} className="flex items-center gap-3 text-xs">
                  <span className="w-8 text-right text-muted-foreground font-medium">{dayLabels[day]}</span>
                  <div className="flex-1 flex gap-0.5 h-5">
                    {blocks.length === 0 ? (
                      <div className="flex-1 rounded bg-muted/30" />
                    ) : (
                    blocks.slice(0, 8).map((b, i) => {
                        const s = safeKindStyle(b.kind, data.categories);
                        const hex = s.customColor ?? TAILWIND_TO_HEX[s.dot] ?? "#6366f1";
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded first:rounded-l-md last:rounded-r-md min-w-[4px]"
                            style={{ backgroundColor: hex }}
                            title={`${b.title} (${b.start}-${b.end})`}
                          />
                        );
                      })
                    )}
                  </div>
                  <span className="w-6 text-right text-muted-foreground/60 num">{blocks.length}</span>
                </div>
              ))}
            </div>

            {/* Category distribution */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {categoryBlocks.slice(0, 8).map(([kind, count]) => {
                const s = safeKindStyle(kind, data.categories);
                const hex = s.customColor ?? TAILWIND_TO_HEX[s.dot] ?? "#6366f1";
                return (
                  <span
                    key={kind}
                    className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ backgroundColor: `${hex}18`, border: `1px solid ${hex}30`, color: hex }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hex }} />
                    {kind}
                    <span className="num opacity-60">{count}</span>
                  </span>
                );
              })}
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 text-xs border-t border-border/40 pt-4">
              <div className="text-center">
                <div className="text-lg font-display text-primary num">{totalH}h</div>
                <div className="text-muted-foreground/60 text-[10px] uppercase tracking-wider">{locale === "pt" ? "Semana" : "Weekly"}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-display text-primary num">{focusPct}%</div>
                <div className="text-muted-foreground/60 text-[10px] uppercase tracking-wider">{locale === "pt" ? "Foco" : "Focus"}</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-display text-primary num">{data.routine.length}</div>
                <div className="text-muted-foreground/60 text-[10px] uppercase tracking-wider">{locale === "pt" ? "Blocos" : "Blocks"}</div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setConfirmNew(true)}
              className="chronos-card p-5 text-left hover:border-secondary/50 transition-colors border-2 border-border"
            >
              <Plus className="h-6 w-6 text-secondary mb-2" />
              <div className="text-sm font-medium text-primary">{pp.newPlan}</div>
              <div className="text-xs text-muted-foreground mt-1">{pp.newPlanDesc}</div>
            </button>
            <button
              onClick={handleChatAbout}
              className="chronos-card p-5 text-left hover:border-secondary/50 transition-colors border-2 border-border"
            >
              <MessageSquare className="h-6 w-6 text-secondary mb-2" />
              <div className="text-sm font-medium text-primary">{pp.chatPlan}</div>
              <div className="text-xs text-muted-foreground mt-1">{pp.chatPlanDesc}</div>
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="chronos-card p-5 text-left hover:border-destructive/50 transition-colors border-2 border-border"
            >
              <Trash2 className="h-6 w-6 text-destructive mb-2" />
              <div className="text-sm font-medium text-primary">{pp.deletePlan}</div>
              <div className="text-xs text-muted-foreground mt-1">{pp.deletePlanDesc}</div>
            </button>
          </div>
        </div>

        {/* Delete confirmation */}
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {pp.deleteConfirmTitle}
              </DialogTitle>
              <DialogDescription>
                {pp.deleteConfirmMessage}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-9 px-4 rounded-lg border border-border text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {pp.cancel}
              </button>
              <button
                onClick={handleDeletePlan}
                className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 transition-colors"
              >
                {pp.deleteConfirmAction}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New plan confirmation */}
        <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-secondary" />
                {pp.newPlan}
              </DialogTitle>
              <DialogDescription>
                {locale === "pt"
                  ? "O plano atual será mantido até você aplicar o novo. Deseja ir para o construtor?"
                  : "Your current plan stays active until you apply the new one. Go to the builder?"}
              </DialogDescription>
            </DialogHeader>
            {/* Current plan preview */}
            <div className="border border-border rounded-lg p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                {locale === "pt" ? "Plano atual" : "Current plan"}
              </div>
              <div className="flex flex-wrap gap-1">
                {categoryBlocks.slice(0, 6).map(([kind, count]) => {
                  const s = safeKindStyle(kind, data.categories);
                  const hex = s.customColor ?? TAILWIND_TO_HEX[s.dot] ?? "#6366f1";
                  return (
                    <span key={kind} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${hex}18`, border: `1px solid ${hex}30`, color: hex }}>
                      {kind}
                    </span>
                  );
                })}
                {categoryBlocks.length > 6 && (
                  <span className="text-[10px] text-muted-foreground/50 px-1">+{categoryBlocks.length - 6}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="num">{Math.round(totalWeeklyMin / 60)}h / week</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="num">{data.routine.length} {locale === "pt" ? "blocos" : "blocks"}</span>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <button
                onClick={() => setConfirmNew(false)}
                className="h-9 px-4 rounded-lg border border-border text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {pp.cancel}
              </button>
              <button
                onClick={() => { setConfirmNew(false); setState("builder"); }}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                {locale === "pt" ? "Sim, criar" : "Yes, create"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (state === "empty") {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="h-12 w-12 rounded-xl bg-muted grid place-items-center mx-auto mb-4">
          <Trash2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="font-display text-xl text-primary mb-2">
          {locale === "pt" ? "Plano removido" : "Plan removed"}
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          {locale === "pt"
            ? "Seu plano foi removido. Nenhum compromisso agendado."
            : "Your plan has been removed. No schedule data."}
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
        >
          {locale === "pt" ? "Ir para o Dashboard" : "Go to Dashboard"}
        </button>
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
