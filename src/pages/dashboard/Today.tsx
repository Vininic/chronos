import { DailyAgenda, PerformanceCard, AetherisCard, FocusBlocksCard, BalanceCard, OptimizationStrip } from "@/components/dashboard/widgets";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n/I18nProvider";

export default function Today() {
  const { session } = useAuth();
  const t = useT();
  const name = session?.name ?? t.chronos.settings.composer;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.chronos.today.greetingMorning : hour < 18 ? t.chronos.today.greetingAfternoon : t.chronos.today.greetingEvening;
  return (
    <>
      <section className="mb-7 animate-fade-up">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.today.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5 text-balance">
          {greeting}, {name}. <span className="text-secondary italic">{t.chronos.today.tagline}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.today.lead}</p>
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