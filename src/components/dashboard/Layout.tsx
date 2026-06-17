import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useTimer } from "@/lib/timer/TimerContext";
import { safeKindStyle } from "@/components/dashboard/widgets";
import { useSchedule } from "@/lib/schedule/store";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, X, ExternalLink, Sparkles } from "lucide-react";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import DemoPrompt from "./DemoPrompt";
import { isDemoMode, clearDemoData, setDemoMode } from "@/lib/demo/generator";

function TimerPopup() {
  const { data } = useSchedule();
  const { running, activeBlock, mm, ss, togglePause, reset, dismiss } = useTimer();
  if (!running) return null;
  const kindVisual = activeBlock?.kind ? safeKindStyle(activeBlock.kind, data.categories) : null;
  return (
    <div className="fixed bottom-6 right-6 z-50 chronos-card-elevated p-4 w-72 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="h-3 w-3 rounded-full" style={kindVisual?.dotStyle ?? { backgroundColor: "hsl(var(--primary))" }} />
          <span className="font-display text-2xl text-primary num tracking-tight">{mm}:{ss}</span>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/dashboard/focus" className="h-6 w-6 grid place-items-center text-muted-foreground hover:text-primary transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <button onClick={dismiss} className="h-6 w-6 grid place-items-center text-muted-foreground hover:text-primary transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {activeBlock && (
        <div className="text-xs text-muted-foreground truncate mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="truncate">{activeBlock.title}</span>
          <span className="num shrink-0">{activeBlock.start}–{activeBlock.end}</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-8 text-xs flex-1" onClick={togglePause}>
          {running ? <><Pause className="h-3.5 w-3.5 mr-1.5" /> Pause</> : <><Play className="h-3.5 w-3.5 mr-1.5" /> Resume</>}
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
        </Button>
      </div>
    </div>
  );
}

function DemoBanner() {
  const { replace } = useSchedule();
  const [demo, setDemo] = useState(isDemoMode());

  if (!demo) return null;

  const handleExit = () => {
    clearDemoData();
    setDemoMode(false);
    setDemo(false);
    replace(null as unknown as never);
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-secondary/10 border-b border-secondary/20 text-xs text-secondary-foreground">
      <span className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        Demo mode — exploring with sample data
      </span>
      <button
        onClick={handleExit}
        className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
      >
        <RotateCcw className="h-3 w-3" />
        Exit demo
      </button>
    </div>
  );
}

export default function DashboardLayout() {
  const loc = useLocation();
  const isAetheris = loc.pathname === "/dashboard/aetheris" || loc.pathname.startsWith("/dashboard/aetheris/");
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Topbar />
        <DemoBanner />
        <main className="flex-1 chronos-surface flex flex-col" style={{ overflow: "auto hidden" }}>
          <div className={`flex-1 ${isAetheris ? '' : 'p-6 lg:p-8'}`}>
            <Outlet />
          </div>
          {!isAetheris && (
            <footer className="py-8 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground shrink-0">
              Chronos · by Vinicius
            </footer>
          )}
        </main>
      </div>
      <TimerPopup />
      <OnboardingWizard />
      <DemoPrompt />
    </div>
  );
}