import { AetherisCard } from "@/components/dashboard/widgets";
import { useSchedule } from "@/lib/schedule/store";
import { Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
export default function Aetheris() {
  const { data, refreshSuggestions } = useSchedule();
  const t = useT();
  const scheduleText = useScheduleText();
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.aetheris.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.aetheris.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.aetheris.lead}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Local rule engine · no external AI calls</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => {
              refreshSuggestions();
              toast({ title: "Suggestions refreshed", description: "Updated from local schedule rules." });
            }}
          >
            Refresh suggestions
          </Button>
        </div>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><AetherisCard /></div>
        <div className="chronos-card p-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-primary grid place-items-center"><Sparkles className="h-4 w-4 text-secondary-soft" /></div>
            <div><div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.aetheris.contextEyebrow}</div><h3 className="font-display text-xl text-primary -mt-0.5">{t.chronos.aetheris.contextTitle}</h3></div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            {[[t.chronos.aetheris.ctxRoutine, data.routine.length],[t.chronos.aetheris.ctxCommitments, data.commitments.length],[t.chronos.aetheris.ctxCategories, data.categories.length],[t.chronos.aetheris.ctxScore, `${data.ledger.compositionScore} / 100`],[t.chronos.aetheris.ctxCycle, scheduleText.cycleName(data.meta.cycle.name)]].map(([l, v]) => (
              <div key={l as string} className="flex items-center justify-between border-b border-border/60 pb-2"><dt className="text-muted-foreground">{l}</dt><dd className="text-primary font-medium num">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-muted-foreground italic leading-relaxed">{t.chronos.aetheris.contextNote}</p>
        </div>
      </div>
    </>
  );
}
