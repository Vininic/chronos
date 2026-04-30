import { DailyAgenda, PerformanceCard, AetherisCard, FocusBlocksCard, BalanceCard, OptimizationStrip } from "@/components/dashboard/widgets";
import { useAuth } from "@/lib/auth";

export default function Today() {
  const { session } = useAuth();
  const name = session?.name ?? "Composer";
  return (
    <>
      <section className="mb-7 animate-fade-up">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Composition</div>
        <h1 className="font-display text-4xl text-primary mt-1.5 text-balance">
          Good morning, {name}. <span className="text-secondary italic">A measured day awaits.</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          The figures below are drawn from your routine and commitments. Aetheris will surface any quiet adjustments as they arise.
        </p>
      </section>
      <OptimizationStrip />
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DailyAgenda />
        <div className="space-y-6">
          <PerformanceCard />
          <FocusBlocksCard />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><AetherisCard /></div>
        <BalanceCard />
      </div>
    </>
  );
}