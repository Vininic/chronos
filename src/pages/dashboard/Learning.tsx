import { useLearningProfile } from "@/lib/ai/learning/store";
import LearningInsights from "@/components/planner/LearningInsights";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

export default function Learning() {
  const { profile, resetProfile } = useLearningProfile();
  const t = useT();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">
            {t.chronos.learning.eyebrow}
          </div>
          <h1 className="font-display text-4xl text-primary mt-1.5">
            {t.chronos.learning.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            {t.chronos.learning.lead}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetProfile}
          className="text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          {t.chronos.learning.reset}
        </Button>
      </div>

      <LearningInsights profile={profile} />
    </div>
  );
}
