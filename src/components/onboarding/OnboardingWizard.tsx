import { useState } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { useOnboarding } from "@/hooks/use-onboarding";
import type { ScheduleTemplate } from "@/lib/schedule/templates";
import type { FunctionComponent, SVGProps } from "react";
import { Blocks, CalendarCheck, Target, Layers, Puzzle, Sparkles, ArrowRight, ArrowLeft, Check } from "lucide-react";

type LucideIcon = FunctionComponent<SVGProps<SVGSVGElement>>;

interface StepDef {
  key: string;
  icon: LucideIcon;
  titleKey: string;
  leadKey: string;
  detailKey: string;
}

const STEPS: StepDef[] = [
  { key: "welcome", icon: Sparkles, titleKey: "welcomeCard.title", leadKey: "welcomeCard.lead", detailKey: "welcomeCard.subtitle" },
  { key: "blocks", icon: Blocks, titleKey: "blocks.title", leadKey: "blocks.lead", detailKey: "blocks.detail" },
  { key: "commitments", icon: CalendarCheck, titleKey: "commitments.title", leadKey: "commitments.lead", detailKey: "commitments.detail" },
  { key: "goals", icon: Target, titleKey: "goals.title", leadKey: "goals.lead", detailKey: "goals.detail" },
  { key: "categories", icon: Layers, titleKey: "categories.title", leadKey: "categories.lead", detailKey: "categories.detail" },
  { key: "programs", icon: Puzzle, titleKey: "programs.title", leadKey: "programs.lead", detailKey: "programs.detail" },
  { key: "aetheris", icon: Sparkles, titleKey: "aetheris.title", leadKey: "aetheris.lead", detailKey: "aetheris.detail" },
];

function tKey(path: string, t: Record<string, unknown>): string {
  const parts = path.split(".");
  let val: unknown = t;
  for (const p of parts) {
    if (val && typeof val === "object" && p in val) {
      val = (val as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof val === "string" ? val : path;
}

const WORKLOAD_STYLES: Record<ScheduleTemplate["workload"], { badge: string; bar: string }> = {
  light: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", bar: "bg-emerald-500" },
  moderate: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", bar: "bg-amber-500" },
  intense: { badge: "bg-rose-500/10 text-rose-400 border-rose-500/20", bar: "bg-rose-500" },
};

export default function OnboardingWizard() {
  const { isFirstRun, templates, complete, applyTemplate, dismiss } = useOnboarding();
  const t = useT();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);

  if (!isFirstRun) return null;

  const isReady = step === STEPS.length;
  const total = STEPS.length + 1;

  function handleNext() {
    if (step < STEPS.length) {
      setStep(step + 1);
    }
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  function handleFinish() {
    complete(choice ?? "explore");
  }

  const stepDef = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4">
        {!isReady ? (
          <div className="chronos-card p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                {stepDef && <stepDef.icon className="h-5 w-5 text-secondary" />}
                <span className="text-xs text-muted-foreground">{t.chronos.onboarding.step(step + 1, total)}</span>
              </div>
              <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                {t.chronos.common.cancel}
              </button>
            </div>

            {stepDef && (
              <div className="min-h-[200px]">
                <h2 className="font-display text-2xl text-primary">
                  {tKey(stepDef.titleKey, t.chronos.onboarding as unknown as Record<string, unknown>)}
                </h2>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {tKey(stepDef.leadKey, t.chronos.onboarding as unknown as Record<string, unknown>)}
                </p>
                <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                  {tKey(stepDef.detailKey, t.chronos.onboarding as unknown as Record<string, unknown>)}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between mt-8">
              <button
                onClick={handleBack}
                disabled={step === 0}
                className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-border hover:bg-secondary/10 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                {t.chronos.onboarding.back}
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 text-xs h-8 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary-deep transition-colors"
              >
                {t.chronos.onboarding.next}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="flex justify-center gap-1.5 mt-6">
              {STEPS.slice(0, 5).map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-border"
                }`} />
              ))}
            </div>
          </div>
        ) : (
          <div className="chronos-card p-8">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs text-muted-foreground">{t.chronos.onboarding.step(total, total)}</span>
              <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                {t.chronos.common.cancel}
              </button>
            </div>

            <h2 className="font-display text-2xl text-primary">{t.chronos.onboarding.ready.title}</h2>
            <p className="text-sm text-muted-foreground mt-2">{t.chronos.onboarding.ready.lead}</p>

            {/* Start from scratch */}
            <button
              onClick={() => setChoice("scratch")}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all mt-6 ${
                choice === "scratch"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-secondary/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-primary">{t.chronos.onboarding.ready.startScratch}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.chronos.onboarding.ready.startScratchDesc}</div>
                </div>
                {choice === "scratch" && (
                  <span className="h-5 w-5 rounded-full bg-primary grid place-items-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </span>
                )}
              </div>
            </button>

            {/* Template gallery */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-primary">{t.chronos.onboarding.ready.useTemplate}</h3>
                <span className="text-[10px] text-muted-foreground">{templates.length} templates</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{t.chronos.onboarding.ready.useTemplateDesc}</p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {templates.map((tmpl) => {
                  const tid = `template:${tmpl.id}`;
                  const isSelected = choice === tid;
                  const ws = WORKLOAD_STYLES[tmpl.workload];
                  return (
                    <div
                      key={tmpl.id}
                      className={`flex-shrink-0 w-56 p-4 rounded-lg border-2 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-secondary/50"
                      }`}
                    >
                      <div className="text-sm font-medium text-primary">{tmpl.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {tmpl.description}
                      </div>

                      <div className="mt-2">
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${ws.badge}`}>
                          {tmpl.workload === "light" ? t.chronos.onboarding.workloadLight : tmpl.workload === "moderate" ? t.chronos.onboarding.workloadModerate : t.chronos.onboarding.workloadIntense}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        <div>
                          <div className="flex justify-between text-[10px] text-muted-foreground/70">
                            <span>{t.chronos.plannerPage.proposals.focus}</span>
                            <span>{Math.round(tmpl.focusRatio * 100)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full rounded-full bg-bronze/80"
                              style={{ width: `${tmpl.focusRatio * 100}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-muted-foreground/70">
                            <span>{t.chronos.plannerPage.proposals.recovery}</span>
                            <span>{Math.round(tmpl.recoveryRatio * 100)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500/80"
                              style={{ width: `${tmpl.recoveryRatio * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setChoice(tid);
                          applyTemplate(tmpl.id);
                        }}
                        className={`mt-3 w-full text-xs h-7 rounded-md border transition-colors ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                        }`}
                      >
                        {isSelected ? t.chronos.plannerPage.proposals.selectPlan : t.chronos.plannerPage.proposals.selectPlan}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Just explore */}
            <div className="mt-6 text-center">
              <button
                onClick={() => setChoice("explore")}
                className={`text-xs transition-colors ${
                  choice === "explore"
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {t.chronos.onboarding.ready.exploreFirst}
              </button>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t.chronos.onboarding.ready.exploreFirstDesc}</p>
            </div>

            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-border hover:bg-secondary/10 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                {t.chronos.onboarding.back}
              </button>
              <button
                onClick={handleFinish}
                disabled={!choice}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs h-8 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary-deep disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                {t.chronos.onboarding.finish}
                <Check className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
