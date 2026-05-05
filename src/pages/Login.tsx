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
  const [name, setName] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { toast({ title: t.chronos.login.needsName }); return; }
    signIn(trimmed);
    toast({ title: t.chronos.login.welcomeBack, description: t.chronos.login.welcomeBackDesc });
    navigate("/dashboard");
  }

  function guest() {
    signIn("Visitante");
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative bg-midnight text-primary-foreground p-10 flex flex-col">
        <div className="flex items-center justify-between">
          <Logo variant="light" />
          <div className="flex items-center gap-2">
            <LanguageToggle variant="dark" />
            <ThemeToggle variant="dark" />
          </div>
        </div>
        <div className="flex-1 grid place-items-center">
          <Hourglass3D className="h-[480px] w-[480px] max-w-full" />
        </div>
        <div>
          <div className="bronze-rule" />
          <p className="font-display text-xl text-primary-foreground/90 mt-5 max-w-md leading-snug">
            {t.chronos.login.quote}
          </p>
        </div>
      </div>

      <div className="chronos-surface flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{t.chronos.login.eyebrow}</div>
          <h1 className="font-display text-4xl text-primary mt-2">{t.chronos.login.title}</h1>
          <p className="text-sm text-muted-foreground mt-3">{t.chronos.login.subtitle}</p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {t.chronos.login.name}
              </Label>
              <Input
                id="name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.chronos.login.namePlaceholder}
                className="h-11 bg-card border-border"
              />
            </div>
            <Button type="submit" className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary-deep">
              {t.chronos.login.enter} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </form>

          <button
            onClick={guest}
            className="mt-3 w-full h-11 rounded-md border border-border bg-card hover:bg-secondary/10 transition-colors text-sm text-muted-foreground"
          >
            {t.chronos.login.continueAsGuest}
          </button>

          <p className="mt-8 text-[11px] text-muted-foreground text-center leading-relaxed">
            {t.chronos.login.localOnly}
          </p>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            <Link to="/" className="text-secondary hover:underline">← Chronos</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
