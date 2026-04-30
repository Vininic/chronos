import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import {
  DailyAgenda, PerformanceCard, AetherisCard, WeeklyRoutine,
  FocusBlocksCard, BalanceCard, OptimizationStrip,
} from "@/components/dashboard/widgets";

export default function Dashboard() {
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 lg:p-8 chronos-surface">
          {/* Greeting */}
          <section className="mb-7 animate-fade-up">
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Composition</div>
            <h1 className="font-display text-4xl text-primary mt-1.5 text-balance">
              Good morning, Aurelia. <span className="text-secondary italic">A measured day awaits.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Three Atlas blocks composed · one Meridian brief · one recovery interval.
              Aetheris has prepared three quiet adjustments for your review.
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
            <WeeklyRoutine />
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2"><AetherisCard /></div>
            <BalanceCard />
          </div>

          <footer className="mt-10 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Chronos · Olympus Suite · Cycle XIV
          </footer>
        </main>
      </div>
    </div>
  );
}
