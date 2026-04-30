import { AetherisCard } from "@/components/dashboard/widgets";
import { useSchedule } from "@/lib/schedule/store";
import { Sparkles } from "lucide-react";
export default function Aetheris() {
  const { data } = useSchedule();
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Aetheris AI</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">Quiet counsel</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Aetheris reads your routine, your commitments, and the cadence of recent weeks to suggest measured adjustments.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><AetherisCard /></div>
        <div className="chronos-card p-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-primary grid place-items-center"><Sparkles className="h-4 w-4 text-secondary-soft" /></div>
            <div><div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Context</div><h3 className="font-display text-xl text-primary -mt-0.5">What Aetheris sees</h3></div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            {[["Routine blocks", data.routine.length],["Commitments", data.commitments.length],["Categories", data.categories.length],["Composition score", `${data.ledger.compositionScore} / 100`],["Cycle", data.meta.cycle.name]].map(([l, v]) => (
              <div key={l as string} className="flex items-center justify-between border-b border-border/60 pb-2"><dt className="text-muted-foreground">{l}</dt><dd className="text-primary font-medium num">{v}</dd></div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-muted-foreground italic leading-relaxed">Suggestions are derived deterministically from the schedule JSON. No external network calls.</p>
        </div>
      </div>
    </>
  );
}
