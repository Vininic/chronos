import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Cloud, MonitorSmartphone, Loader2 } from "lucide-react";
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

type Mode = "local" | "cloud";

export default function Login() {
  const { signIn, isCloud } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [mode, setMode] = useState<Mode>("local");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const L = t.chronos.login;

  function enterLocal(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { toast({ title: L.needsName }); return; }
    void signIn(trimmed);
    toast({ title: L.welcomeBack, description: L.welcomeBackDesc });
    navigate("/dashboard");
  }

  async function enterCloud(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { toast({ title: L.needsEmailPass }); return; }
    setLoading(true);
    try {
      const err = await signIn(name.trim() || undefined, email.trim(), password);
      if (typeof err === "string") {
        toast({ title: err });
        return;
      }
      toast({ title: L.cloudWelcome });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  function guest() {
    void signIn("Visitante");
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
            {L.quote}
          </p>
        </div>
      </div>

      <div className="chronos-surface flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">{L.eyebrow}</div>
          <h1 className="font-display text-4xl text-primary mt-2">{L.title}</h1>

          {/* Mode switch — local (guest) vs cloud account. Cloud only when configured. */}
          {isCloud && (
            <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setMode("local")}
                className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-medium transition-colors ${mode === "local" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
              >
                <MonitorSmartphone className="h-3.5 w-3.5" /> {L.modeLocal}
              </button>
              <button
                type="button"
                onClick={() => setMode("cloud")}
                className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-medium transition-colors ${mode === "cloud" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}
              >
                <Cloud className="h-3.5 w-3.5" /> {L.modeCloud}
              </button>
            </div>
          )}

          <p className="text-sm text-muted-foreground mt-3">
            {mode === "cloud" ? L.cloudBlurb : L.localBlurb}
          </p>

          {mode === "local" ? (
            <>
              <form className="mt-7 space-y-5" onSubmit={enterLocal}>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {L.name}
                  </Label>
                  <Input
                    id="name"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={L.namePlaceholder}
                    className="h-11 bg-card border-border"
                  />
                </div>
                <Button type="submit" className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary-deep">
                  {L.enter} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </form>

              <button
                onClick={guest}
                className="mt-3 w-full h-11 rounded-md border border-border bg-card hover:bg-secondary/10 transition-colors text-sm text-muted-foreground"
              >
                {L.continueAsGuest}
              </button>

              <p className="mt-8 text-[11px] text-muted-foreground text-center leading-relaxed">
                {L.localOnly}
              </p>
            </>
          ) : (
            <>
              <form className="mt-7 space-y-4" onSubmit={enterCloud}>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {L.email}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={L.emailPlaceholder}
                    className="h-11 bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {L.password}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={L.passwordPlaceholder}
                    className="h-11 bg-card border-border"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary-deep">
                  {loading ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> {L.signingIn}</>
                  ) : (
                    <>{L.cloudEnter} <ArrowRight className="ml-1.5 h-4 w-4" /></>
                  )}
                </Button>
              </form>
              <p className="mt-4 text-[11px] text-muted-foreground text-center leading-relaxed">
                {L.cloudHint}
              </p>
            </>
          )}

          {!isCloud && (
            <p className="mt-4 text-[11px] text-muted-foreground/70 text-center leading-relaxed">
              {L.cloudUnavailable}
            </p>
          )}

          <p className="mt-6 text-xs text-muted-foreground text-center">
            <Link to="/" className="text-secondary hover:underline">← Chronos</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
