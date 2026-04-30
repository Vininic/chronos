import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Calendar, Brain, ShieldCheck, Clock, BarChart3 } from "lucide-react";
import Hourglass3D from "./Hourglass3D";
import Logo from "./Logo";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen chronos-surface">
      {/* Nav */}
      <header className="container flex items-center justify-between py-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#philosophy" className="hover:text-foreground transition">Philosophy</a>
          <a href="#system" className="hover:text-foreground transition">The System</a>
          <a href="#intelligence" className="hover:text-foreground transition">Intelligence</a>
          <a href="#suite" className="hover:text-foreground transition">The Suite</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition">Sign in</Link>
          <Link to="/dashboard">
            <Button className="bg-primary text-primary-foreground hover:bg-primary-deep h-10 px-5">
              Open Chronos <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container grid lg:grid-cols-12 gap-8 items-center pt-10 pb-24">
        <div className="lg:col-span-7 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            Chronos · I — The Flagship of the Olympus Suite
          </div>
          <h1 className="font-display text-[64px] leading-[0.98] md:text-[88px] mt-6 text-balance text-primary">
            Time, <span className="italic text-secondary">designed.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
            Chronos is the executive operating system for time — an AI-assisted atelier for
            routines, focus blocks, and the architecture of a deliberate week.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/dashboard">
              <Button className="bg-primary text-primary-foreground hover:bg-primary-deep h-12 px-7 text-[15px]">
                Begin your hour <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline" className="h-12 px-6 text-[15px] border-primary/20 hover:bg-secondary/10 hover:text-primary">
                Request preview
              </Button>
            </Link>
          </div>
          <div className="mt-12 flex items-center gap-8 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <span>Trusted by operators at</span>
            <div className="flex items-center gap-7 font-display text-base text-primary/70 normal-case tracking-normal">
              <span>Atlas&nbsp;Capital</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">Meridian&nbsp;&amp;&nbsp;Co</span>
              <span className="hidden md:inline">·</span>
              <span className="hidden md:inline">Aurelius</span>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5 relative h-[460px] md:h-[560px]">
          <div className="absolute inset-0 rounded-[28px] bg-midnight shadow-elevated overflow-hidden">
            <div className="absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #D8B06A 1px, transparent 0)", backgroundSize: "22px 22px" }} />
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between text-primary-foreground/70 text-[11px] tracking-[0.2em] uppercase">
              <span>Aetheris · Mk.III</span>
              <span>22 : 14 : 06</span>
            </div>
            <Hourglass3D className="absolute inset-0" />
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
              <div className="text-primary-foreground/85">
                <div className="font-display text-2xl">Σ 6h 42m</div>
                <div className="text-xs uppercase tracking-[0.2em] text-secondary-soft">Deep work · today</div>
              </div>
              <div className="h-12 w-12 rounded-full bg-bronze grid place-items-center shadow-bronze">
                <Sparkles className="h-5 w-5 text-primary-deep" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy strip */}
      <section id="philosophy" className="border-y bg-card/60">
        <div className="container py-10 grid md:grid-cols-3 gap-8">
          {[
            { k: "I", t: "Cadence over chaos", d: "Routines composed, not improvised." },
            { k: "II", t: "Hours, not tasks", d: "Time is the ledger. Outcomes the entry." },
            { k: "III", t: "Quiet intelligence", d: "AI that suggests, never demands." },
          ].map((p) => (
            <div key={p.k} className="flex gap-5">
              <div className="font-display text-3xl text-secondary leading-none pt-1">{p.k}</div>
              <div>
                <div className="font-display text-xl text-primary">{p.t}</div>
                <p className="text-sm text-muted-foreground mt-1.5">{p.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The System */}
      <section id="system" className="container py-24">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">The System</div>
          <h2 className="font-display text-5xl mt-3 text-primary text-balance">
            An atelier for the architecture of your week.
          </h2>
        </div>
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { i: Calendar, t: "Routine Composer", d: "Design weekly cadences with the rigor of a score — recurring rituals, deliberate margins, recovery built in." },
            { i: Brain, t: "Focus Blocks", d: "Protected hours sealed against meeting drift. Sessions ranked by depth, not duration." },
            { i: Sparkles, t: "Aetheris AI", d: "An advisor — not a chatbot. Quiet recommendations to rebalance load and reclaim mornings." },
            { i: BarChart3, t: "Performance Ledger", d: "A weekly summary that reads like a report from a chief of staff." },
            { i: Clock, t: "Schedule Surgery", d: "One-tap restructuring of fragmented days into long, coherent arcs." },
            { i: ShieldCheck, t: "Recovery Balance", d: "Deep work and recovery treated as a single equation, not opposing forces." },
          ].map(({ i: Icon, t, d }) => (
            <article key={t} className="chronos-card p-7 group hover:shadow-elevated transition-shadow duration-500">
              <div className="h-11 w-11 rounded-lg bg-secondary/10 grid place-items-center text-secondary group-hover:bg-bronze group-hover:text-primary-deep transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl text-primary mt-5">{t}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Intelligence band */}
      <section id="intelligence" className="bg-midnight text-primary-foreground">
        <div className="container py-24 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="text-xs uppercase tracking-[0.22em] text-secondary-soft">Aetheris · Quiet Intelligence</div>
            <h2 className="font-display text-5xl mt-3 text-balance">
              An advisor with the discretion of a chief of staff.
            </h2>
            <p className="text-primary-foreground/70 mt-6 max-w-xl leading-relaxed">
              Aetheris reads the shape of your week and proposes — never imposes —
              minute adjustments: a Tuesday compressed, a Thursday lengthened,
              an evening returned to you.
            </p>
            <div className="mt-10 grid sm:grid-cols-3 gap-5">
              {[
                { n: "+38%", l: "Deep-work hours, six weeks in" },
                { n: "−52%", l: "Calendar fragmentation" },
                { n: "9.3 / 10", l: "Operator satisfaction" },
              ].map((s) => (
                <div key={s.n} className="border-l-2 border-secondary pl-4">
                  <div className="font-display text-3xl text-secondary-soft num">{s.n}</div>
                  <div className="text-xs text-primary-foreground/60 mt-1.5 leading-snug">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-primary-foreground/10 bg-primary-deep/60 p-6 backdrop-blur">
              <div className="text-[11px] uppercase tracking-[0.22em] text-secondary-soft">Today · Suggestion</div>
              <p className="font-display text-2xl mt-3 leading-snug">
                "Your Wednesday holds three sub-30 minute gaps. Consolidate into a
                <span className="text-secondary-soft"> 90-minute Atlas block</span> at 14:00."
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Button className="bg-secondary text-primary-deep hover:bg-secondary-soft h-10">Apply suggestion</Button>
                <button className="text-sm text-primary-foreground/70 hover:text-primary-foreground">Decline</button>
              </div>
              <div className="bronze-rule mt-7" />
              <div className="mt-5 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 7 * 6 }).map((_, i) => {
                  const intensity = [0.06, 0.12, 0.2, 0.35, 0.55, 0.8][i % 6];
                  return <div key={i} className="aspect-square rounded-sm" style={{ background: `hsl(35 51% 55% / ${intensity})` }} />;
                })}
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-primary-foreground/50">Six weeks · density of focus</div>
            </div>
          </div>
        </div>
      </section>

      {/* Suite */}
      <section id="suite" className="container py-24">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">The Olympus Suite</div>
          <h2 className="font-display text-5xl mt-3 text-primary text-balance">
            Three deities. One operating discipline.
          </h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {[
            { n: "Chronos", r: "Time", d: "Routines, focus, calendar architecture.", c: "bg-midnight text-primary-foreground", live: true },
            { n: "Pluto", r: "Wealth", d: "Forecasting, budgets, financial intelligence.", c: "bg-card text-primary border" },
            { n: "Hermes", r: "Operations", d: "Workflows, agents, integrations.", c: "bg-card text-primary border" },
          ].map((p) => (
            <div key={p.n} className={`rounded-2xl p-7 ${p.c} relative overflow-hidden`}>
              <div className="text-xs uppercase tracking-[0.22em] opacity-70">{p.r}</div>
              <div className="font-display text-4xl mt-2">{p.n}</div>
              <p className={`text-sm mt-4 ${p.live ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{p.d}</p>
              <div className="mt-8 text-xs flex items-center gap-2">
                {p.live ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary text-primary-deep px-2.5 py-1 font-medium">Live</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-muted-foreground">In atelier</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/60">
        <div className="container py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo />
          <div className="text-xs text-muted-foreground">© MMXXVI Chronos. Composed in measured hours.</div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground">Manifesto</a>
            <a href="#" className="hover:text-foreground">Press</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
