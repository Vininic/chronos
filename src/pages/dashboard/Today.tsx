import { DayPlanner } from "@/components/dashboard/DayPlanner";
import { BalanceCard, FocusBlocksCard, AetherisCard } from "@/components/dashboard/widgets";
import { useAuth } from "@/lib/auth";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";

export default function Today() {
  const { session } = useAuth();
  const { bcp47 } = useI18n();
  const t = useT();
  const firstName = session?.name?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.chronos.today.greetingMorning : hour < 18 ? t.chronos.today.greetingAfternoon : t.chronos.today.greetingEvening;
  const dateStr = new Date().toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <header className="mb-5 animate-fade-up">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.today.eyebrow}</div>
        <h1 className="font-display text-3xl text-primary mt-1">
          {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">{dateStr}</p>
      </header>

      <DayPlanner />

      <section className="mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5"><FocusBlocksCard /></div>
          <div className="lg:col-span-7"><BalanceCard /></div>
        </div>
        <div className="mt-6">
          <AetherisCard compact />
        </div>
      </section>
    </>
  );
}
