import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import Hourglass3D from "@/components/chronos/Hourglass3D";
import Logo from "@/components/chronos/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanguageToggle } from "@/components/suite/LanguageToggle";
import { ThemeToggle } from "@/components/suite/ThemeToggle";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [email, setEmail] = useState("aurelia.vance@chronos.app");
  const [password, setPassword] = useState("composer");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) { toast({ title: t.chronos.login.invalidEmail }); return; }
    if (password.length < 4)  { toast({ title: t.chronos.login.shortPass }); return; }
    signIn(email);
    toast({ title: t.chronos.login.welcomeBack, description: t.chronos.login.welcomeBackDesc });
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left ceremonial pane */}
      <div className="relative bg-midnight text-primary-foreground p-10 flex flex-col">
        <div className="flex items-center justify-between">
          <Logo variant="light" />
          <div className="flex items-center gap-2">
            <LanguageToggle variant="dark" />
            <ThemeToggle variant="dark" />
          </div>
        </div>
        <div className="flex-1 grid place-items-center">
          <Hourglass3D className="h-[520px] w-[520px] max-w-full" />
        </div>
        <div>
          <div className="bronze-rule" />
          <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-primary-foreground/60">
            <span>{t.common.suite} · I</span>
            <span>Aetheris Mk.III</span>
          </div>
          <p className="font-display text-2xl text-primary-foreground/95 mt-4 max-w-md leading-snug">
            {t.chronos.login.quote}
          </p>
        </div>
      </div>

      {/* Right form pane */}
      <div className="chronos-surface flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{t.chronos.login.eyebrow}</div>
          <h1 className="font-display text-4xl text-primary mt-2">{t.chronos.login.title}</h1>
          <p className="text-sm text-muted-foreground mt-3">{t.chronos.login.subtitle}</p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.login.email}</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@atelier.co" className="h-11 bg-card border-border" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.login.passphrase}</Label>
                <a href="#" className="text-xs text-secondary hover:underline">{t.chronos.login.forgot}</a>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" className="h-11 bg-card border-border" />
            </div>
            <Button type="submit" className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary-deep">
              {t.chronos.login.enter} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> {t.chronos.login.orDivider} <div className="h-px flex-1 bg-border" />
          </div>

          <button onClick={() => { signIn("guest@chronos.app"); navigate("/dashboard"); }} className="mt-5 w-full h-11 rounded-md border border-border bg-card hover:bg-secondary/10 transition-colors text-sm font-medium text-primary">
            {t.chronos.login.sso}
          </button>

          <p className="mt-10 text-xs text-muted-foreground text-center">
            {t.chronos.login.newToSuite} <Link to="/" className="text-secondary hover:underline">{t.chronos.login.requestInvite}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
