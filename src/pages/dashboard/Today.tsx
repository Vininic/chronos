import { DayPlanner } from "@/components/dashboard/DayPlanner";
import { BalanceCard, FocusBlocksCard, AetherisCard } from "@/components/dashboard/widgets";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n/I18nProvider";

export default function Today() {
  const { session } = useAuth();
  const t = useT();
  const name = session?.name?.split(" ")[0] ?? t.chronos.settings.composer;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.chronos.today.greetingMorning : hour < 18 ? t.chronos.today.greetingAfternoon : t.chronos.today.greetingEvening;

  return (
    <>
      <header className="mb-5 animate-fade-up">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.today.eyebrow}</div>
        <h1 className="font-display text-3xl text-primary mt-1">
          {greeting}, {name}.
        </h1>
      </header>

      <DayPlanner />

      <section className="mt-10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary mb-4">{t.chronos.today.moreBelow}</div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5"><FocusBlocksCard /></div>
          <div className="lg:col-span-7"><BalanceCard /></div>
        </div>
        <div className="mt-6">
          <AetherisCard />
        </div>
      </section>
    </>
  );
}
