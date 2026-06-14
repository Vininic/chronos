import { useState, type FormEvent } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_PREFERENCES } from "@/lib/ai/planner/generator";
import type { PlannerPreferences, WorkMode, FocusPreference, RecoveryPriority } from "@/lib/ai/planner/types";
import { useT } from "@/lib/i18n/I18nProvider";

interface Props {
  onSubmit: (prefs: PlannerPreferences) => void;
}

export default function PlannerForm({ onSubmit }: Props) {
  const t = useT();
  const [workMode, setWorkMode] = useState<WorkMode>(DEFAULT_PREFERENCES.workMode);
  const [workHoursStart, setWorkHoursStart] = useState(DEFAULT_PREFERENCES.workHoursStart);
  const [workHoursEnd, setWorkHoursEnd] = useState(DEFAULT_PREFERENCES.workHoursEnd);
  const [focusPreference, setFocusPreference] = useState<FocusPreference>(DEFAULT_PREFERENCES.focusPreference);
  const [recoveryPriority, setRecoveryPriority] = useState<RecoveryPriority>(DEFAULT_PREFERENCES.recoveryPriority);
  const [categoriesInput, setCategoriesInput] = useState("");
  const [sleepStart, setSleepStart] = useState(DEFAULT_PREFERENCES.sleepStart);
  const [sleepEnd, setSleepEnd] = useState(DEFAULT_PREFERENCES.sleepEnd);

  const workModes: { value: WorkMode; label: string }[] = [
    { value: "remote", label: t.chronos.plannerPage.form.remote },
    { value: "hybrid", label: t.chronos.plannerPage.form.hybrid },
    { value: "office", label: t.chronos.plannerPage.form.office },
    { value: "student", label: t.chronos.plannerPage.form.student },
    { value: "freelance", label: t.chronos.plannerPage.form.freelance },
  ];

  const focusOptions: { value: FocusPreference; label: string; desc: string }[] = [
    { value: "deep-work", label: t.chronos.plannerPage.form.deepWork, desc: t.chronos.plannerPage.form.deepWorkDesc },
    { value: "balanced", label: t.chronos.plannerPage.form.balanced, desc: t.chronos.plannerPage.form.balancedDesc },
    { value: "varied", label: t.chronos.plannerPage.form.varied, desc: t.chronos.plannerPage.form.variedDesc },
  ];

  const recoveryOptions: { value: RecoveryPriority; label: string; desc: string }[] = [
    { value: "low", label: t.chronos.plannerPage.form.low, desc: t.chronos.plannerPage.form.lowDesc },
    { value: "medium", label: t.chronos.plannerPage.form.medium, desc: t.chronos.plannerPage.form.mediumDesc },
    { value: "high", label: t.chronos.plannerPage.form.high, desc: t.chronos.plannerPage.form.highDesc },
  ];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const weeklyCategories = categoriesInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    onSubmit({
      workMode,
      workHoursStart,
      workHoursEnd,
      focusPreference,
      recoveryPriority,
      weeklyCategories,
      sleepStart,
      sleepEnd,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-8">
      <header className="text-center">
        <Wand2 className="h-8 w-8 text-secondary mx-auto mb-3" />
        <h1 className="font-display text-4xl text-primary">{t.chronos.plannerPage.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
          {t.chronos.plannerPage.lead}
        </p>
      </header>

      <Card className="chronos-card">
        <CardHeader>
          <CardTitle className="text-lg">{t.chronos.plannerPage.form.workMode}</CardTitle>
          <CardDescription>{t.chronos.plannerPage.form.workModeDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {workModes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setWorkMode(mode.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  workMode === mode.value
                    ? "border-secondary bg-secondary/20 text-secondary"
                    : "border-border text-muted-foreground hover:border-secondary/40 hover:text-primary"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="chronos-card">
        <CardHeader>
          <CardTitle className="text-lg">{t.chronos.plannerPage.form.workHours}</CardTitle>
          <CardDescription>{t.chronos.plannerPage.form.workHoursDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{t.chronos.plannerPage.form.start}</label>
              <input
                type="time"
                value={workHoursStart}
                onChange={(e) => setWorkHoursStart(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-primary text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </div>
            <span className="text-muted-foreground mt-6">→</span>
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{t.chronos.plannerPage.form.end}</label>
              <input
                type="time"
                value={workHoursEnd}
                onChange={(e) => setWorkHoursEnd(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-primary text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="chronos-card">
        <CardHeader>
          <CardTitle className="text-lg">{t.chronos.plannerPage.form.focusStyle}</CardTitle>
          <CardDescription>{t.chronos.plannerPage.form.focusStyleDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {focusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFocusPreference(opt.value)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                  focusPreference === opt.value
                    ? "border-secondary bg-secondary/20 text-secondary"
                    : "border-border text-muted-foreground hover:border-secondary/40 hover:text-primary"
                }`}
              >
                <span className="font-medium text-sm">{opt.label}</span>
                <span className="text-xs opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="chronos-card">
        <CardHeader>
          <CardTitle className="text-lg">{t.chronos.plannerPage.form.recovery}</CardTitle>
          <CardDescription>{t.chronos.plannerPage.form.recoveryDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recoveryOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRecoveryPriority(opt.value)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                  recoveryPriority === opt.value
                    ? "border-secondary bg-secondary/20 text-secondary"
                    : "border-border text-muted-foreground hover:border-secondary/40 hover:text-primary"
                }`}
              >
                <span className="font-medium text-sm">{opt.label}</span>
                <span className="text-xs opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="chronos-card">
        <CardHeader>
          <CardTitle className="text-lg">{t.chronos.plannerPage.form.categories}</CardTitle>
          <CardDescription>{t.chronos.plannerPage.form.categoriesDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="text"
            value={categoriesInput}
            onChange={(e) => setCategoriesInput(e.target.value)}
            placeholder={t.chronos.plannerPage.form.categoriesPlaceholder}
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-primary text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Separate categories with commas. Base types (Deep Work, Meeting, Ritual, Recovery, Shallow, Sleep) are always included.
          </p>
        </CardContent>
      </Card>

      <Card className="chronos-card">
        <CardHeader>
          <CardTitle className="text-lg">{t.chronos.plannerPage.form.sleep}</CardTitle>
          <CardDescription>{t.chronos.plannerPage.form.sleepDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{t.chronos.plannerPage.form.start}</label>
              <input
                type="time"
                value={sleepStart}
                onChange={(e) => setSleepStart(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-primary text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </div>
            <span className="text-muted-foreground mt-6">→</span>
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{t.chronos.plannerPage.form.end}</label>
              <input
                type="time"
                value={sleepEnd}
                onChange={(e) => setSleepEnd(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-primary text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center pb-8">
        <Button type="submit" size="lg" className="px-10">
          <Wand2 className="h-4 w-4 mr-2" />
          {t.chronos.plannerPage.form.generate}
        </Button>
      </div>
    </form>
  );
}
