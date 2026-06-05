import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import DashboardLayout from "./components/dashboard/Layout";
import Today from "./pages/dashboard/Today";
import Week from "./pages/dashboard/Week";
import Focus from "./pages/dashboard/Focus";
import Aetheris from "./pages/dashboard/Aetheris";
import About from "./pages/dashboard/About";
import AIAssistant from "./pages/dashboard/AIAssistant";
import { ScheduleProvider } from "@/lib/schedule/store";
import { TimerProvider } from "@/lib/timer/TimerContext";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

const queryClient = new QueryClient();

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session } = useAuth();
  return session ? children : <Navigate to="/login" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <I18nProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <ScheduleProvider>
                <TimerProvider>
                <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
                <Route index element={<Today />} />
                <Route path="week" element={<Week />} />
                <Route path="focus" element={<Focus />} />
                <Route path="aetheris" element={<Aetheris />} />
                <Route path="about" element={<About />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="ledger" element={<Navigate to="/dashboard" replace />} />
                <Route path="atlas" element={<Navigate to="/dashboard" replace />} />
                <Route path="settings" element={<Navigate to="/dashboard" replace />} />
                <Route path="support" element={<Navigate to="/dashboard/about" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
                </Routes>
                </TimerProvider>
              </ScheduleProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
