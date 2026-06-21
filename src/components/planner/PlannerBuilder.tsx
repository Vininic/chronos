import { useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { SCHEDULE_TEMPLATES, createEmptySchedule } from "@/lib/schedule/templates";
import type { ScheduleTemplate } from "@/lib/schedule/templates";
import type { PlannerProposal, PlannerPreferences } from "@/lib/ai/planner/types";
import type { LearningProfile } from "@/lib/ai/learning/types";
import type { ScheduleData } from "@/lib/schedule/types";
import { generateProposals } from "@/lib/ai/planner/generator";
import { generateGeminiProposals } from "@/lib/ai/planner/gemini-planner";
import PlannerForm from "./PlannerForm";
import CategoryInput from "./CategoryInput";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Check, Sparkles, FileText, Wand2, Merge } from "lucide-react";

interface PlannerBuilderProps {
  onApply: (schedule: ScheduleData) => void;
  learningProfile?: LearningProfile;
}

const WORKLOAD_STYLES: Record<ScheduleTemplate["workload"], { badge: string; bar: string }> = {
  light: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", bar: "bg-emerald-500" },
  moderate: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", bar: "bg-amber-500" },
  intense: { badge: "bg-rose-500/10 text-rose-400 border-rose-500/20", bar: "bg-rose-500" },
};

export default function PlannerBuilder({ onApply, learningProfile }: PlannerBuilderProps) {
  const t = useT();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [startPoint, setStartPoint] = useState<"scratch" | "template" | "ai" | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);
  const [proposals, setProposals] = useState<PlannerProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<PlannerProposal | null>(null);
  const [generatedSchedule, setGeneratedSchedule] = useState<ScheduleData | null>(null);
  const [aiPrefs, setAiPrefs] = useState<PlannerPreferences | null>(null);
  const [editedCategories, setEditedCategories] = useState("");
  const [showProposalPicker, setShowProposalPicker] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [daySelections, setDaySelections] = useState<Record<number, string>>({});
  const [merging, setMerging] = useState(false);

  const b = t.chronos.plannerPage.builder;

  function handleStartPointChoice(choice: "scratch" | "template" | "ai") {
    setStartPoint(choice);
    if (choice === "scratch") {
      setGeneratedSchedule(createEmptySchedule());
      setEditedCategories("");
      setStep(3);
    } else if (choice === "template") {
      setSelectedTemplate(null);
      setStep(2);
    } else {
      setShowProposalPicker(false);
      setProposals([]);
      setSelectedProposal(null);
      setAiPrefs(null);
      setStep(2);
    }
  }

  function handleTemplateSelect(tmpl: ScheduleTemplate) {
    setSelectedTemplate(tmpl);
    setGeneratedSchedule(tmpl.generate());
    const cats = tmpl.generate().categories.map((c) => c.label).join(", ");
    setEditedCategories(cats);
    setStep(3);
  }

  function handleFormSubmit(prefs: PlannerPreferences) {
    setAiPrefs(prefs);
    setGenerating(true);
    generateGeminiProposals(prefs, learningProfile).then((generated) => {
      setProposals(generated);
      setGenerating(false);
      if (generated.length > 0) {
        setShowProposalPicker(true);
      }
    });
  }

  function handleSelectProposal(proposal: PlannerProposal) {
    setGenerating(true);
    setSelectedProposal(proposal);
    proposal.generate().then((schedule) => {
      setGeneratedSchedule(schedule);
      const cats = schedule.categories.map((c) => c.label).join(", ");
      setEditedCategories(cats);
      setGenerating(false);
      setStep(3);
    });
  }

  function handleRegenerate() {
    if (startPoint === "scratch") {
      setGeneratedSchedule(createEmptySchedule());
      setEditedCategories("");
    } else if (startPoint === "template" && selectedTemplate) {
      const s = selectedTemplate.generate();
      setGeneratedSchedule(s);
      setEditedCategories(s.categories.map((c) => c.label).join(", "));
    } else if (startPoint === "ai" && selectedProposal && aiPrefs) {
      const parsedCats = editedCategories
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const updatedPrefs = { ...aiPrefs, weeklyCategories: parsedCats };
      setGenerating(true);
      generateGeminiProposals(updatedPrefs, learningProfile).then((newProposals) => {
        if (newProposals.length > 0) {
          setProposals(newProposals);
          setSelectedProposal(newProposals[0]);
          newProposals[0].generate().then((schedule) => {
            setGeneratedSchedule(schedule);
            setEditedCategories(schedule.categories.map((c) => c.label).join(", "));
            setGenerating(false);
          });
        } else {
          setGenerating(false);
        }
      });
    }
  }

  function handleApply() {
    if (generatedSchedule) {
      let { categories } = generatedSchedule;
      if (editedCategories.trim().length > 0) {
        const editedLabels = editedCategories
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        // Start from existing categories, then add any new labels from the edited list
        const reconciled = [...categories];
        for (const label of editedLabels) {
          const exists = reconciled.some((c) => c.label.toLowerCase() === label.toLowerCase());
          if (!exists) {
            const id = label.toLowerCase().replace(/\s+/g, "-");
            reconciled.push({
              id,
              label,
              tone: id === "deep" ? "bronze" : "neutral",
              description: `${label} activities.`,
            });
          }
        }
        categories = reconciled;
      }
      // Final safety: ensure every routine block kind has a matching category
      const knownKinds = new Set(categories.map((c) => c.id));
      for (const b of generatedSchedule.routine) {
        if (b.kind === "sleep") continue;
        if (!knownKinds.has(b.kind)) {
          categories.push({
            id: b.kind,
            label: b.kind.charAt(0).toUpperCase() + b.kind.slice(1),
            tone: "neutral",
            description: `${b.kind} activities.`,
          });
          knownKinds.add(b.kind);
        }
      }
      onApply({ ...generatedSchedule, categories });
    }
  }

  async function handleMerge() {
    const selectedIds = new Set(Object.values(daySelections));
    if (selectedIds.size === 0) return;

    setMerging(true);
    try {
      const schedules = await Promise.all(
        proposals
          .filter((p) => selectedIds.has(p.id))
          .map((p) => p.generate()),
      );
      const valid = schedules.filter(Boolean) as ScheduleData[];
      if (valid.length === 0) return;

      // Build a map: proposal id → schedule
      const scheduleMap = new Map<string, ScheduleData>();
      for (let i = 0; i < proposals.length; i++) {
        if (selectedIds.has(proposals[i].id) && valid[i]) {
          scheduleMap.set(proposals[i].id, valid[i]);
        }
      }

      // Merge: for each day, take blocks from the selected proposal's schedule
      const base = valid[0];
      const merged: ScheduleData = {
        ...base,
        routine: base.routine.filter((b) => !selectedIds.has(daySelections[b.day] ?? "")),
        commitments: base.commitments.filter((c) => !selectedIds.has(daySelections[c.day] ?? "")),
      };

      for (const [proposalId, schedule] of scheduleMap) {
        const daysForThis = Object.entries(daySelections)
          .filter(([, v]) => v === proposalId)
          .map(([k]) => parseInt(k, 10));
        const daySet = new Set(daysForThis);
        merged.routine.push(...schedule.routine.filter((b) => daySet.has(b.day)));
        merged.commitments.push(...schedule.commitments.filter((c) => daySet.has(c.day)));
      }

      // Merge categories from all sources
      const catMap = new Map<string, typeof base.categories[0]>();
      for (const s of valid) {
        for (const c of s.categories) {
          if (!catMap.has(c.id)) catMap.set(c.id, c);
        }
      }
      merged.categories = [...catMap.values()];

      setGeneratedSchedule(merged);
      const labels = merged.categories.map((c) => c.label).join(", ");
      setEditedCategories(labels);
      setMerging(false);
      setMergeMode(false);
      setStep(3);
    } catch {
      setMerging(false);
    }
  }

  function goBack() {
    if (step === 2 && startPoint === "ai" && showProposalPicker) {
      setShowProposalPicker(false);
      return;
    }
    if (step === 2) {
      setStep(1);
      return;
    }
    if (step === 3) {
      if (startPoint === "scratch") {
        setStep(1);
        return;
      }
      setStep(2);
      return;
    }
    if (step === 4) {
      setStep(3);
      return;
    }
  }

  function goNext() {
    if (step === 3 && generatedSchedule) {
      setStep(4);
    }
  }

  const scheduledHours = generatedSchedule
    ? generatedSchedule.ledger.scheduledHours.reduce((a, b) => a + b, 0)
    : 0;
  const categoryCount = generatedSchedule?.categories.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl text-primary">{b.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{b.step(step)}</p>
      </header>

      {/* STEP 1: Start Point */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-display text-primary mb-4 text-center">{b.startPoint}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleStartPointChoice("scratch")}
              className="chronos-card p-6 text-left hover:border-secondary/50 transition-colors border-2 border-border"
            >
              <FileText className="h-8 w-8 text-secondary mb-3" />
              <div className="text-sm font-medium text-primary">{b.scratch}</div>
              <div className="text-xs text-muted-foreground mt-1">{b.scratchDesc}</div>
            </button>
            <button
              onClick={() => handleStartPointChoice("template")}
              className="chronos-card p-6 text-left hover:border-secondary/50 transition-colors border-2 border-border"
            >
              <Sparkles className="h-8 w-8 text-secondary mb-3" />
              <div className="text-sm font-medium text-primary">{b.template}</div>
              <div className="text-xs text-muted-foreground mt-1">{b.templateDesc}</div>
            </button>
            <button
              onClick={() => handleStartPointChoice("ai")}
              className="chronos-card p-6 text-left hover:border-secondary/50 transition-colors border-2 border-border"
            >
              <Wand2 className="h-8 w-8 text-secondary mb-3" />
              <div className="text-sm font-medium text-primary">{b.aiPlan}</div>
              <div className="text-xs text-muted-foreground mt-1">{b.aiPlanDesc}</div>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Configuration */}
      {step === 2 && startPoint === "template" && (
        <div>
          <h2 className="text-lg font-display text-primary mb-2 text-center">{b.chooseTemplate}</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
            {SCHEDULE_TEMPLATES.map((tmpl) => {
              const isSelected = selectedTemplate?.id === tmpl.id;
              const ws = WORKLOAD_STYLES[tmpl.workload];
              return (
                <div
                  key={tmpl.id}
                  className={`flex-shrink-0 w-56 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-secondary/50"
                  }`}
                  onClick={() => handleTemplateSelect(tmpl)}
                >
                  <div className="text-sm font-medium text-primary">{tmpl.name}</div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {tmpl.description}
                  </div>
                  <div className="mt-2">
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${ws.badge}`}>
                      {tmpl.workload === "light"
                        ? t.chronos.onboarding.workloadLight
                        : tmpl.workload === "moderate"
                        ? t.chronos.onboarding.workloadModerate
                        : t.chronos.onboarding.workloadIntense}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground/70">
                        <span>{t.chronos.plannerPage.proposals.focus}</span>
                        <span>{Math.round(tmpl.focusRatio * 100)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-border overflow-hidden">
                        <div className="h-full rounded-full bg-bronze/80" style={{ width: `${tmpl.focusRatio * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground/70">
                        <span>{t.chronos.plannerPage.proposals.recovery}</span>
                        <span>{Math.round(tmpl.recoveryRatio * 100)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-border overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${tmpl.recoveryRatio * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 w-full text-xs h-7 rounded-md border flex items-center justify-center transition-colors bg-primary text-primary-foreground border-primary">
                    <Check className="h-3 w-3 mr-1" />
                    {t.chronos.plannerPage.proposals.selectPlan}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {b.back}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && startPoint === "ai" && !showProposalPicker && (
        <div>
          <h2 className="text-lg font-display text-primary mb-4 text-center">{b.fillPrefs}</h2>
          <PlannerForm onSubmit={handleFormSubmit} />
          <div className="flex justify-center mt-4">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {b.back}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && startPoint === "ai" && showProposalPicker && (
        <div>
          <h2 className="text-lg font-display text-primary mb-2 text-center">
            {t.chronos.plannerPage.proposals.title}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {generating ? "Generating your personalized schedule..." : t.chronos.plannerPage.proposals.subtitle}
          </p>

          {generating ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Wand2 className="h-8 w-8 text-secondary animate-pulse" />
                <p className="text-sm text-muted-foreground">AI is designing your schedule...</p>
              </div>
            </div>
          ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className={`chronos-card flex flex-col p-5 border-2 transition-colors cursor-pointer ${
                  selectedProposal?.id === proposal.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-secondary/50"
                }`}
                onClick={() => !generating && handleSelectProposal(proposal)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-base text-primary">{proposal.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{proposal.description}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${
                    proposal.workload === "light"
                      ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                      : proposal.workload === "moderate"
                      ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                      : "text-red-500 border-red-500/30 bg-red-500/10"
                  }`}>
                    {proposal.workload}
                  </span>
                </div>
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{t.chronos.plannerPage.proposals.focus}</span>
                    <span>{Math.round(proposal.focusRatio * 100)}%</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                    <div className="bg-bronze transition-all" style={{ width: `${proposal.focusRatio * 100}%` }} />
                    <div className="bg-emerald-500 transition-all" style={{ width: `${proposal.recoveryRatio * 100}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>{t.chronos.plannerPage.proposals.recovery}</span>
                    <span>{Math.round(proposal.recoveryRatio * 100)}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="flex items-center gap-1.5 p-2 rounded-lg border border-border/60">
                    <span className="text-secondary">{proposal.categoryCount}</span>
                    <span className="text-muted-foreground">{b.categories.toLowerCase()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-lg border border-border/60">
                    <span className="text-secondary">{proposal.weeklyBlockCount}</span>
                    <span className="text-muted-foreground">{b.weeklyBlocks.toLowerCase()}</span>
                  </div>
                </div>
                <div className="mt-auto">
                  <div className={`w-full text-xs h-8 rounded-md border flex items-center justify-center transition-colors ${
                    selectedProposal?.id === proposal.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}>
                    {selectedProposal?.id === proposal.id ? (
                      <><Check className="h-3 w-3 mr-1" /> {t.chronos.plannerPage.proposals.selectPlan}</>
                    ) : (
                      t.chronos.plannerPage.proposals.selectPlan
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-3 mt-6">
            <Button variant="outline" onClick={() => { setMergeMode(true); setDaySelections({}); }} disabled={generating || proposals.length < 2}>
              <Merge className="h-4 w-4 mr-1.5" />
              Compare & Merge
            </Button>
            <Button variant="outline" onClick={goBack} disabled={generating}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {b.back}
            </Button>
          </div>
          </>
          )}
        </div>
      )}

      {/* MERGE & COMPARE */}
      {step === 2 && startPoint === "ai" && mergeMode && proposals.length >= 2 && (
        <div>
          <h2 className="text-lg font-display text-primary mb-2 text-center">Compare & Merge</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Choose which plan to use for each day of the week.
          </p>

          {generating || merging ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Wand2 className="h-8 w-8 text-secondary animate-pulse" />
                <p className="text-sm text-muted-foreground">Generating merged schedule...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                return (
                  <div key={day} className="flex items-center gap-4 p-3 rounded-lg border border-border">
                    <span className="w-12 text-sm font-medium text-primary">{dayNames[day]}</span>
                    <div className="flex gap-3 flex-wrap">
                      {proposals.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setDaySelections((prev) => ({ ...prev, [day]: p.id }))}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            daySelections[day] === p.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary"
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-center gap-3 pt-4">
                <Button onClick={handleMerge} disabled={Object.keys(daySelections).length < 7 || merging}>
                  <Merge className="h-4 w-4 mr-1.5" />
                  Merge Selected
                </Button>
                <Button variant="outline" onClick={() => setMergeMode(false)}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Back to Plans
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Review & Customize */}
      {step === 3 && generatedSchedule && (
        <div>
          <h2 className="text-lg font-display text-primary mb-2 text-center">{b.review}</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">{b.reviewDesc}</p>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="chronos-card p-4 text-center">
              <div className="text-2xl font-display text-primary">{categoryCount}</div>
              <div className="text-xs text-muted-foreground mt-1">{b.categories}</div>
            </div>
            <div className="chronos-card p-4 text-center">
              <div className="text-2xl font-display text-primary">{Math.round(scheduledHours)}h</div>
              <div className="text-xs text-muted-foreground mt-1">{b.weeklyBlocks}</div>
            </div>
            <div className="chronos-card p-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-bronze" />
                <span className="font-display text-primary">
                  {startPoint === "template" && selectedTemplate
                    ? `${Math.round(selectedTemplate.focusRatio * 100)}%`
                    : startPoint === "ai" && selectedProposal
                    ? `${Math.round(selectedProposal.focusRatio * 100)}%`
                    : "—"}
                </span>
                <span className="text-xs text-muted-foreground">/</span>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="font-display text-primary">
                  {startPoint === "template" && selectedTemplate
                    ? `${Math.round(selectedTemplate.recoveryRatio * 100)}%`
                    : startPoint === "ai" && selectedProposal
                    ? `${Math.round(selectedProposal.recoveryRatio * 100)}%`
                    : "—"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{b.focusBalance}</div>
            </div>
          </div>

          <div className="chronos-card p-5 mb-6">
            <label className="text-xs font-medium text-primary mb-2 block">{b.categories}</label>
            <CategoryInput
              value={editedCategories}
              onChange={setEditedCategories}
              placeholder="Add, edit or remove categories..."
            />
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {b.back}
            </Button>
            <Button variant="outline" onClick={handleRegenerate}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              {b.regenerate}
            </Button>
            <Button onClick={goNext}>
              {b.next}
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4: Apply */}
      {step === 4 && generatedSchedule && (
        <div>
          <h2 className="text-lg font-display text-primary mb-2 text-center">{b.apply}</h2>

          <div className="chronos-card p-6 mb-6 max-w-md mx-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{b.categories}</span>
                <span className="text-primary font-medium">{categoryCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{b.weeklyBlocks}</span>
                <span className="text-primary font-medium">{Math.round(scheduledHours)}h</span>
              </div>
              {startPoint === "template" && selectedTemplate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{b.focusBalance}</span>
                  <span className="text-primary font-medium">
                    {Math.round(selectedTemplate.focusRatio * 100)}% / {Math.round(selectedTemplate.recoveryRatio * 100)}%
                  </span>
                </div>
              )}
              {startPoint === "ai" && selectedProposal && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{b.focusBalance}</span>
                  <span className="text-primary font-medium">
                    {Math.round(selectedProposal.focusRatio * 100)}% / {Math.round(selectedProposal.recoveryRatio * 100)}%
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Categorias</span>
                <span className="text-primary font-medium text-right max-w-[200px] truncate">
                  {editedCategories}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              {b.back}
            </Button>
            <Button onClick={handleApply}>
              <Check className="h-4 w-4 mr-1.5" />
              {b.apply}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
