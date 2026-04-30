import { PerformanceCard, BalanceCard, OptimizationStrip } from "@/components/dashboard/widgets";
import { useSchedule } from "@/lib/schedule/store";
import { durationMin } from "@/lib/schedule/types";
import { useT } from "@/lib/i18n/I18nProvider";
export default function Ledger() {
  const { data } = useSchedule();
  const t = useT();
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
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PerformanceCard /><div className="lg:col-span-2"><BalanceCard /></div>
      </div>
      <section className="mt-8 chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.ledger.allocationEyebrow}</div>
        <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.ledger.allocationTitle}</h3>
        <ul className="mt-5 space-y-3">
          {breakdown.map((b) => { const pct = Math.round((b.total / sum) * 100); return (
            <li key={b.id}>
              <div className="flex items-center justify-between text-sm"><span className="text-primary">{t.common.kinds[b.id]}</span><span className="text-muted-foreground num">{Math.floor(b.total/60)}h {b.total%60}m · {pct}%</span></div>
              <div className="h-2 mt-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-bronze" style={{ width: `${pct}%` }} /></div>
            </li>); })}
        </ul>
      </section>
    </>
  );
}
