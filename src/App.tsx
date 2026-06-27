import { Component, useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PwaUpdateWatcher } from "@/components/PwaUpdateWatcher";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import DashboardLayout from "./components/dashboard/Layout";
import Today from "./pages/dashboard/Today";
import Week from "./pages/dashboard/Week";
import Focus from "./pages/dashboard/Focus";
import Aetheris from "./pages/dashboard/Aetheris";
import Planner from "./pages/dashboard/Planner";
import About from "./pages/dashboard/About";
import Settings from "./pages/dashboard/Settings";

import { ScheduleProvider } from "@/lib/schedule/store";
import { TimerProvider } from "@/lib/timer/TimerContext";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { SupabaseScheduleRepository } from "@/lib/supabase/SupabaseScheduleRepository";
import { LocalStorageScheduleRepository } from "@/lib/schedule/infrastructure/LocalStorageScheduleRepository";
import type { ScheduleRepository } from "@/lib/schedule/ports/ScheduleRepository";
import { useSyncEngine } from "@/lib/sync/userDataSync";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div style={{ padding: 40, fontFamily: "monospace" }}><h2>Something went wrong</h2><pre style={{ whiteSpace: "pre-wrap", color: "red" }}>{this.state.error.stack ?? this.state.error.message}</pre></div>;
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session } = useAuth();
  return session ? children : <Navigate to="/login" replace />;
}

function ScheduleProviderWithRepo({ children }: { children: ReactNode }) {
  // React to auth: the cloud repository is used ONLY for a real cloud account (a
  // session with an email, i.e. signed in via Supabase). A local "guest" session
  // (name only) always stays on the local repository, even when a Supabase project
  // is configured. Switching is reactive (no full reload needed); the store's
  // hydration guard prevents the local seed from clobbering the remote.
  const { session, isCloud } = useAuth();
  const cloudAccount = isCloud && !!session?.email;
  const repo = useMemo<ScheduleRepository>(
    () => (cloudAccount ? new SupabaseScheduleRepository() : new LocalStorageScheduleRepository()),
    [cloudAccount],
  );
  return <ScheduleProvider repo={repo}>{children}</ScheduleProvider>;
}

/** Mirrors the non-schedule user stores (learning, chat, digests, settings…) to the
 *  cloud when signed in. Renders nothing; must live inside AuthProvider. */
function SyncEngineMount() {
  useSyncEngine();
  return null;
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PwaUpdateWatcher />
          <BrowserRouter>
            <AuthProvider>
              <ScheduleProviderWithRepo>
                <SyncEngineMount />
                <TimerProvider>
                <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
                <Route index element={<Today />} />
                <Route path="week" element={<Week />} />
                <Route path="focus" element={<Focus />} />
                <Route path="aetheris" element={<Aetheris />} />
                <Route path="planner" element={<Planner />} />
                <Route path="about" element={<About />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
                </Routes>
                </TimerProvider>
              </ScheduleProviderWithRepo>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
