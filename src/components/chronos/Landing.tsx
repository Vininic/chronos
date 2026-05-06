import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Hourglass3D from "./Hourglass3D";
import Logo from "./Logo";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanguageToggle } from "@/components/suite/LanguageToggle";
import { ThemeToggle } from "@/components/suite/ThemeToggle";

export default function Landing() {
  const t = useT();
  const L = t.chronos.landing;
  const projectGithub = "https://github.com/Vininic/chronos-the-art-of-time";

  return (
    <div className="min-h-screen chronos-surface">
      <header className="container flex items-center justify-between py-6">
        <Logo />
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#what" className="hover:text-foreground transition">{L.navSystem}</a>
          <a href="#suite" className="hover:text-foreground transition">{L.navSuite}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          <Link to="/dashboard">
            <Button className="bg-primary text-primary-foreground hover:bg-primary-deep h-10 px-5">
              {L.open} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <section className="container grid lg:grid-cols-12 gap-8 items-center pt-12 pb-20">
        <div className="lg:col-span-7 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            {L.tagline}
          </div>
          <h1 className="font-display text-[60px] leading-[1.0] md:text-[80px] mt-6 text-balance text-primary">
            {L.heroTitle1} <span className="italic text-secondary">{L.heroTitle2}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground leading-relaxed">
            {L.heroLead}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/dashboard">
              <Button className="bg-primary text-primary-foreground hover:bg-primary-deep h-12 px-7">
                {L.ctaPrimary} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
        <div className="lg:col-span-5 relative h-[420px] md:h-[520px]">
          <div className="absolute inset-0 rounded-[28px] bg-midnight shadow-elevated overflow-hidden">
            <Hourglass3D className="absolute inset-0" />
          </div>
        </div>
      </section>

      <section id="what" className="container py-20 border-t">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{L.systemEyebrow}</div>
          <h2 className="font-display text-4xl mt-3 text-primary text-balance">{L.systemTitle}</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {L.systemCards.map((c) => (
            <article key={c.t} className="chronos-card p-6">
              <h3 className="font-display text-lg text-primary">{c.t}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{c.d}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-border bg-card p-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{L.privacyEyebrow}</div>
          <p className="text-sm text-muted-foreground mt-2">{L.privacyLead}</p>
        </div>
      </section>

      <section id="suite" className="container py-20 border-t">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{L.suiteEyebrow}</div>
          <h2 className="font-display text-4xl mt-3 text-primary text-balance">{L.suiteTitle}</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {L.suiteProducts.map((p, i) => {
            const live = i === 0;
            return (
              <div
                key={p.n}
                className={`rounded-2xl p-6 relative overflow-hidden ${
                  live
                    ? "bg-midnight border border-secondary/20 shadow-elevated"
                    : "bg-card text-primary border"
                }`}
              >
                <div className={`text-xs uppercase tracking-[0.22em] ${live ? "text-secondary-soft" : "opacity-70"}`}>{p.r}</div>
                <div className={`font-display text-3xl mt-2 ${live ? "text-sidebar-foreground" : ""}`}>{p.n}</div>
                <p className={`text-sm mt-3 ${live ? "text-sidebar-foreground/70" : "text-muted-foreground"}`}>{p.d}</p>
                <div className="mt-6 text-xs">
                  {live ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary text-primary-deep px-2.5 py-1 font-medium">{L.live}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-muted-foreground">{L.inAtelier}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t bg-card/60">
        <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo />
          <div className="text-xs text-muted-foreground">{L.footerRights} {L.footerAuthor}</div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <a href={projectGithub} target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
