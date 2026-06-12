import { NavLink } from "react-router-dom";
import { LayoutDashboard, Calendar, Brain, Sparkles, CircleHelp, Target, BarChart3, Play } from "lucide-react";
import Logo from "@/components/chronos/Logo";
import { useSchedule } from "@/lib/schedule/store";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { useState, useMemo } from "react";
import ProfileDialog from "./ProfileDialog";
import { ProgressDialog } from "./ProgressDialog";
import { BlockSessionBadge, SessionView } from "./SessionView";
import { buildAgendaForDate } from "@/lib/schedule/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Sidebar() {
  const { data, overallGoalProgress, updateRoutine, updateCommitment } = useSchedule();
  const { session } = useAuth();
  const t = useT();
  const scheduleText = useScheduleText();
  const [profileOpen, setProfileOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);

  const now = new Date();
  const weekProgress = Math.round(((now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes()) / 10080) * 100);

  const [sessionOpen, setSessionOpen] = useState(false);

  const activeSession = useMemo(() => {
    const agenda = buildAgendaForDate(data, now);
    const item = agenda.find((a) => {
      const cat = data.categories.find((c) => c.id === a.kind);
      return cat?.workspace && a.workspace?._sessionStarted && !a.workspace?._sessionEnded;
    });
    if (item) {
      const cat = data.categories.find((c) => c.id === item.kind);
      return cat?.workspace ? { item, cat } : null;
    }
    return null;
  }, [data, now]);

  const main = [
    { to: "/dashboard",          label: t.chronos.nav.today,    icon: LayoutDashboard },
    { to: "/dashboard/week",     label: t.chronos.nav.week,     icon: Calendar },
    { to: "/dashboard/focus",    label: t.chronos.nav.focus,    icon: Brain },
    { to: "/dashboard/aetheris", label: t.chronos.nav.aetheris, icon: Sparkles },
  ];
  const meta = [
    { to: "/dashboard/about",    label: t.chronos.nav.about,    icon: CircleHelp },
  ];
  const initial = (session?.name ?? "A").trim().charAt(0).toUpperCase();
  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 h-screen sticky top-0 overflow-y-auto bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-6 pt-7 pb-6">
        <Logo variant="light" />
      </div>

      <div className="px-4 mt-2">
        <button onClick={() => setProgressOpen(true)} className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3.5 py-3 text-left hover:bg-sidebar-accent/60 transition-colors">
          <div className="text-[10px] uppercase tracking-[0.22em] text-secondary-soft">{t.chronos.nav.cycle} {data.meta.cycle.number} · {t.chronos.nav.week_short} {data.meta.cycle.week}</div>
          <div className="font-display text-lg text-sidebar-foreground mt-1">{scheduleText.cycleName(data.meta.cycle.name)}</div>
          <div className="mt-3 h-1.5 rounded-full bg-sidebar-border overflow-hidden">
            <div className="h-full bg-bronze" style={{ width: `${weekProgress}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-sidebar-foreground/70 num">{weekProgress}% {t.chronos.nav.arcCompleted}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-sidebar-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-secondary-soft">
                <Target className="h-3 w-3" />
                <span>{t.chronos.goals.eyebrow}</span>
              </div>
              <span className="text-[11px] text-sidebar-foreground/70 num">{Math.round(overallGoalProgress() * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-sidebar-border overflow-hidden">
              <div className="h-full bg-bronze transition-all" style={{ width: `${Math.round(overallGoalProgress() * 100)}%` }} />
            </div>
          </div>
        </button>
        <ProgressDialog open={progressOpen} onOpenChange={setProgressOpen} />
      </div>

      <nav className="flex-1 px-3 mt-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/50 px-3 mb-2">{t.chronos.nav.composition}</div>
        {main.map(({ to, label, icon: Icon }) => {
          const badge = to === "/dashboard/aetheris" && data.suggestions.length > 0 ? data.suggestions.length : undefined;
          return (
          <NavLink
            key={to}
            to={to}
            end={to === "/dashboard"}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-secondary pl-[10px]"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`
            }
          >
            <Icon className="h-4 w-4 text-secondary-soft" />
            <span className="flex-1">{label}</span>
            {badge ? (
              <span className="text-[10px] font-semibold rounded-full bg-secondary text-primary-deep px-1.5 py-0.5 num">{badge}</span>
            ) : null}
          </NavLink>
        );})}

        <div className="text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/50 px-3 mt-7 mb-2">{t.chronos.nav.system}</div>
        {meta.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {activeSession && (
        <div className="px-4 mb-2">
          <button
            onClick={() => setSessionOpen(true)}
            className="w-full rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 p-2.5 flex items-center gap-2.5 hover:bg-sidebar-accent/60 transition-colors text-left"
          >
            <div className="relative h-9 w-9 rounded-full bg-sidebar-accent grid place-items-center shrink-0 overflow-hidden"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9'%3E%3Cpath d='M1 0v9M0 1h9' stroke='%23ffffff' stroke-opacity='0.08' stroke-width='0.5'/%3E%3C/svg%3E")`, backgroundSize: '9px 9px' }}>
              <Play className="h-4 w-4 text-secondary relative z-10" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse ring-2 ring-sidebar-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-secondary-soft mb-0.5">{activeSession.cat.label}</div>
              <BlockSessionBadge structure={activeSession.cat.workspace!} runtime={activeSession.item.workspace ?? {}} tier="micro" />
            </div>
          </button>
          <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
            <DialogContent className="max-w-lg overflow-y-auto max-h-[80vh]">
              <DialogHeader>
                <DialogTitle>{activeSession.cat.label}</DialogTitle>
              </DialogHeader>
              {activeSession.cat.workspace && (
                <SessionView
                  structure={activeSession.cat.workspace}
                  runtime={activeSession.item.workspace ?? {}}
                  onChange={(r) => {
                    const id = activeSession.item.sourceId ?? activeSession.item.id;
                    if (activeSession.item.source === "routine") {
                      updateRoutine(id, { workspace: r });
                    } else {
                      updateCommitment(id, { workspace: r });
                    }
                  }}
                  onClose={() => setSessionOpen(false)}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="p-4">
        <button
          onClick={() => setProfileOpen(true)}
          className="w-full rounded-lg bg-sidebar-accent/50 border border-sidebar-border p-3 flex items-center gap-3 hover:bg-sidebar-accent transition-colors text-left"
        >
          <div className="h-9 w-9 rounded-full bg-bronze grid place-items-center text-primary-deep font-display font-semibold shrink-0">{initial}</div>
          <div className="min-w-0">
            <div className="text-sm text-sidebar-accent-foreground truncate">{session?.name ?? data.meta.owner}</div>
            <div className="text-[11px] text-sidebar-foreground/50 truncate">{t.common.appName}</div>
          </div>
        </button>
        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    </aside>
  );
}
