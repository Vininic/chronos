import { NavLink } from "react-router-dom";
import { LayoutDashboard, Calendar, Brain, Sparkles, Wand2, CircleHelp, Target, Settings2, PanelLeftClose, Check, History, ScrollText, FileText } from "lucide-react";
import Logo from "@/components/chronos/Logo";
import { useSchedule } from "@/lib/schedule/store";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { useState, useEffect } from "react";
import ProfileDialog from "./ProfileDialog";
import { ProgressDialog } from "./ProgressDialog";
import { TimerCard } from "./TimerCard";
import { subscribe, getAetherisCount } from "@/lib/notification-count";

export default function Sidebar() {
  const { data, overallGoalProgress } = useSchedule();
  const { session } = useAuth();
  const t = useT();
  const scheduleText = useScheduleText();
const [profileOpen, setProfileOpen] = useState(false);
const [progressOpen, setProgressOpen] = useState(false);
const [collapsed, setCollapsed] = useState(false);
const [aetherisCount, setAetherisCount] = useState(getAetherisCount());
useEffect(() => subscribe(setAetherisCount), []);

  const now = new Date();
  const weekProgress = Math.round(((now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes()) / 10080) * 100);

  const main = [
    { to: "/dashboard",          label: t.chronos.nav.today,    icon: LayoutDashboard },
    { to: "/dashboard/week",     label: t.chronos.nav.week,     icon: Calendar },
    { to: "/dashboard/focus",    label: t.chronos.nav.focus,    icon: Brain },
    { to: "/dashboard/aetheris", label: t.chronos.nav.aetheris, icon: Sparkles },
    { to: "/dashboard/planner",  label: t.chronos.nav.planner,  icon: Wand2 },
  ];
  const meta = [
    { to: "/dashboard/settings", label: t.chronos.nav.settings, icon: Settings2 },
    { to: "/dashboard/about",     label: t.chronos.nav.about, icon: CircleHelp },
  ];
  const initial = (session?.name ?? "A").trim().charAt(0).toUpperCase();
  return (
    <aside className={`hidden lg:flex flex-col shrink-0 h-screen sticky top-0 overflow-y-auto bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out ${
      collapsed ? "w-[72px]" : "w-[260px]"
    }`}>
      <div className="flex items-center justify-between px-6 pt-7 pb-6">
        <div className={collapsed ? "hidden" : ""}>
          <Logo variant="light" />
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 w-7 rounded-md hover:bg-sidebar-accent/60 grid place-items-center transition-all duration-300 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeftClose className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className={`px-4 mt-2 ${collapsed ? "hidden" : ""}`}>
        <button onClick={() => setProgressOpen(true)} className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3.5 py-3 text-left hover:bg-sidebar-accent/60 transition-colors">
          <div className="text-[10px] uppercase tracking-[0.22em] text-secondary-soft">{t.chronos.nav.cycle} {data.meta.cycle.number} · {t.chronos.nav.week_short} {data.meta.cycle.week}</div>
          <div className="font-display text-lg text-sidebar-foreground mt-1">{scheduleText.cycleName(data.meta.cycle.name)}</div>
          <div className="mt-3 h-1.5 rounded-full bg-sidebar-border overflow-hidden">
            <div className="h-full bg-bronze" style={{ width: `${weekProgress}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-sidebar-foreground/70 num">{weekProgress}% {t.chronos.nav.arcCompleted}</span>
          </div>
          {data.goals.length > 0 && (<div className="mt-3 pt-3 border-t border-sidebar-border/50">
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
          </div>)}
        </button>
        <ProgressDialog open={progressOpen} onOpenChange={setProgressOpen} />
      </div>

      <nav className="flex-1 px-3 mt-6">
        <div className={`text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/50 px-3 mb-2 ${collapsed ? "hidden" : ""}`}>{t.chronos.nav.composition}</div>
        {main.map(({ to, label, icon: Icon }) => {
          const badge = to === "/dashboard/aetheris" && aetherisCount > 0 ? aetherisCount : undefined;
          const aetherisClear = to === "/dashboard/aetheris" && aetherisCount === 0;
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
            title={collapsed ? label : undefined}
          >
            <Icon className="h-4 w-4 text-secondary-soft shrink-0" />
            <span className={`flex-1 ${collapsed ? "hidden" : ""}`}>{label}</span>
            {badge && !collapsed ? (
              <span className="text-[10px] font-semibold rounded-full bg-secondary text-primary-deep px-1.5 py-0.5 num">{badge}</span>
            ) : aetherisClear && !collapsed ? (
              <span className="text-[10px] rounded-full bg-emerald-500/20 text-emerald-500 px-1 py-0.5 flex items-center"><Check className="h-3 w-3" /></span>
            ) : null}
          </NavLink>
        );})}

        <div className={`text-[10px] uppercase tracking-[0.22em] text-sidebar-foreground/50 px-3 mt-7 mb-2 ${collapsed ? "hidden" : ""}`}>{t.chronos.nav.system}</div>
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
            title={collapsed ? label : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className={`${collapsed ? "hidden" : ""}`}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-4 mt-4 mb-2">
          <TimerCard />
        </div>
      )}

      <div className="px-4 pb-4 pt-2">
        <button
          onClick={() => setProfileOpen(true)}
          className={`w-full rounded-lg bg-sidebar-accent/50 border border-sidebar-border p-3 flex items-center gap-3 hover:bg-sidebar-accent transition-colors text-left ${collapsed ? "justify-center" : ""}`}
        >
          <div className="h-9 w-9 rounded-full bg-bronze grid place-items-center text-primary-deep font-display font-semibold shrink-0">{initial}</div>
          <div className={`min-w-0 ${collapsed ? "hidden" : ""}`}>
            <div className="text-sm text-sidebar-accent-foreground truncate">{session?.name ?? data.meta.owner}</div>
            <div className="text-[11px] text-sidebar-foreground/50 truncate">{t.common.appName}</div>
          </div>
        </button>
        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    </aside>
  );
}
