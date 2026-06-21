import { Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { useSchedule } from "@/lib/schedule/store";
import { RotateCcw, Sparkles } from "lucide-react";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import DemoPrompt from "./DemoPrompt";
import { isDemoMode, clearDemoData, setDemoMode } from "@/lib/demo/generator";
import { autoCaptureLogs } from "@/lib/schedule/dailyLog";

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
  const { data } = useSchedule();
  const isAetheris = loc.pathname === "/dashboard/aetheris" || loc.pathname.startsWith("/dashboard/aetheris/");

  // Silently build the historical daily log on first mount each session
  useEffect(() => { autoCaptureLogs(data); }, []);
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Topbar />
        <DemoBanner />
        <main className={`flex-1 chronos-surface overflow-y-auto overflow-x-hidden${isAetheris ? ' flex flex-col' : ''}`}>
          {isAetheris ? (
            <div className="flex-1 min-h-0">
              <Outlet />
            </div>
          ) : (
            <div className="min-h-full flex flex-col">
              <div className="flex-1 p-6 lg:p-8">
                <Outlet />
              </div>
              <footer className="py-8 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Chronos · by Vinicius
              </footer>
            </div>
          )}
        </main>
      </div>
      <OnboardingWizard />
      <DemoPrompt />
    </div>
  );
}