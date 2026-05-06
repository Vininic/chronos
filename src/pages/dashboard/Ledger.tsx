import { PerformanceCard, BalanceCard, OptimizationStrip, kindStyle } from "@/components/dashboard/widgets";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind, durationMin } from "@/lib/schedule/types";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";
export default function Ledger() {
  const { data } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const metricMap = Object.fromEntries(data.ledger.metrics.map((m) => [m.label, m.value])) as Record<string, number>;
  const depth = metricMap.Depth ?? 0;
  const cadence = metricMap.Cadence ?? 0;
  const recovery = metricMap.Recovery ?? 0;

  const scoreReasons = [
    t.chronos.ledger.reasonDepth(Math.round(depth * 0.45)),
    t.chronos.ledger.reasonCadence(Math.round(cadence * 0.3)),
    t.chronos.ledger.reasonRecovery(Math.round(recovery * 0.25)),
  ];

  const nextSteps: string[] = [];
  if (depth < 80) nextSteps.push(t.chronos.ledger.nextStepDepth);
  if (cadence < 80) nextSteps.push(t.chronos.ledger.nextStepCadence);
  if (recovery < 80) nextSteps.push(t.chronos.ledger.nextStepRecovery);
  if (nextSteps.length === 0) nextSteps.push(t.chronos.ledger.nextStepMaintain);

  const breakdown = data.categories.map((c) => ({ ...c, total: data.routine.filter((r) => r.kind === c.id).reduce((s, r) => s + durationMin(r.start, r.end), 0) }));
  const sum = breakdown.reduce((s, b) => s + b.total, 0) || 1;
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.ledger.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.ledger.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.ledger.lead}</p>
      </header>
      <OptimizationStrip />
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5"><PerformanceCard /></div>
        <div className="lg:col-span-7"><BalanceCard /></div>
      </div>
      <section className="mt-8 chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.ledger.clarityEyebrow}</div>
        <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.ledger.clarityTitle}</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          {t.chronos.ledger.clarityLead}
        </p>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-md border border-border/60 bg-surface-raised p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t.chronos.ledger.depthTitle}</div>
            <div className="font-display text-2xl text-primary num mt-1">{depth}</div>
            <p className="text-xs text-muted-foreground mt-1">{t.chronos.ledger.depthDesc}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-surface-raised p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t.chronos.ledger.cadenceTitle}</div>
            <div className="font-display text-2xl text-primary num mt-1">{cadence}</div>
            <p className="text-xs text-muted-foreground mt-1">{t.chronos.ledger.cadenceDesc}</p>
          </div>
          <div className="rounded-md border border-border/60 bg-surface-raised p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{t.chronos.ledger.recoveryTitle}</div>
            <div className="font-display text-2xl text-primary num mt-1">{recovery}</div>
            <p className="text-xs text-muted-foreground mt-1">{t.chronos.ledger.recoveryDesc}</p>
          </div>
        </div>
        <div className="mt-4 rounded-md border border-border/60 p-4">
          <div className="text-sm font-medium text-primary">{t.chronos.ledger.currentScoreWhy(data.ledger.compositionScore)}</div>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {scoreReasons.map((r) => (<li key={r}>• {r}</li>))}
          </ul>
          <div className="mt-3 text-sm font-medium text-primary">{t.chronos.ledger.practicalNextSteps}</div>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
            {nextSteps.map((step) => (<li key={step}>• {step}</li>))}
          </ul>
        </div>
      </section>
      <section className="mt-8 chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.ledger.allocationEyebrow}</div>
        <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.ledger.allocationTitle}</h3>
        <ul className="mt-5 space-y-4">
          {breakdown.map((b) => {
            const pct = Math.round((b.total / sum) * 100);
            const s = kindStyle[b.id as BlockKind];
            return (
              <li key={b.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2 text-primary">
                    <span className={`h-2 w-2 rounded-full ${s?.dot ?? "bg-secondary"}`} />
                    {t.common.kinds[b.id]}
                  </span>
                  <span className="text-muted-foreground num">{fmtDur(b.total)} · {pct}%</span>
                </div>
                <div className="h-2 mt-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${s?.dot ?? "bg-bronze"}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
