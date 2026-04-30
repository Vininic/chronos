import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Hourglass3D from "@/components/chronos/Hourglass3D";
import Logo from "@/components/chronos/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left ceremonial pane */}
      <div className="relative bg-midnight text-primary-foreground p-10 flex flex-col">
        <Logo variant="light" />
        <div className="flex-1 grid place-items-center">
          <Hourglass3D className="h-[520px] w-[520px] max-w-full" />
        </div>
        <div>
          <div className="bronze-rule" />
          <div className="mt-5 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-primary-foreground/60">
            <span>Olympus Suite · I</span>
            <span>Aetheris Mk.III</span>
          </div>
          <p className="font-display text-2xl text-primary-foreground/95 mt-4 max-w-md leading-snug">
            "An hour deliberately spent is the only hour truly possessed."
          </p>
        </div>
      </div>

      {/* Right form pane */}
      <div className="chronos-surface flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-secondary">Welcome back</div>
          <h1 className="font-display text-4xl text-primary mt-2">Enter the atelier.</h1>
          <p className="text-sm text-muted-foreground mt-3">Continue composing your week.</p>

          <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Email</Label>
              <Input id="email" type="email" placeholder="you@atelier.co" className="h-11 bg-card border-border" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Passphrase</Label>
                <a href="#" className="text-xs text-secondary hover:underline">Forgotten?</a>
              </div>
              <Input id="password" type="password" placeholder="••••••••••" className="h-11 bg-card border-border" />
            </div>
            <Link to="/dashboard" className="block">
              <Button className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary-deep">
                Enter Chronos <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </form>

          <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <button className="mt-5 w-full h-11 rounded-md border border-border bg-card hover:bg-secondary/10 transition-colors text-sm font-medium text-primary">
            Continue with Single Sign-On
          </button>

          <p className="mt-10 text-xs text-muted-foreground text-center">
            New to the suite? <Link to="/dashboard" className="text-secondary hover:underline">Request an invitation</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
