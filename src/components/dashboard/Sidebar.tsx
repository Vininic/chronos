import { NavLink } from "react-router-dom";
import { LayoutDashboard, Calendar, Brain, Sparkles, BarChart3, Settings, LifeBuoy, Compass } from "lucide-react";
import Logo from "@/components/chronos/Logo";
import { useSchedule } from "@/lib/schedule/store";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n/I18nProvider";

export default function Sidebar() {
  const { data } = useSchedule();
  const { session } = useAuth();
  const t = useT();
  const main = [
    { to: "/dashboard",          label: t.chronos.nav.today,    icon: LayoutDashboard },
    { to: "/dashboard/week",     label: t.chronos.nav.week,     icon: Calendar },
    { to: "/dashboard/focus",    label: t.chronos.nav.focus,    icon: Brain },
    { to: "/dashboard/aetheris", label: t.chronos.nav.aetheris, icon: Sparkles },
    { to: "/dashboard/ledger",   label: t.chronos.nav.ledger,   icon: BarChart3 },
  ];
  const meta = [
    { to: "/dashboard/atlas",    label: t.chronos.nav.atlas,    icon: Compass },
    { to: "/dashboard/settings", label: t.chronos.nav.settings, icon: Settings },
    { to: "/dashboard/support",  label: t.chronos.nav.support,  icon: LifeBuoy },
  ];
  const cycle = data.meta.cycle;
  const initial = (session?.name ?? "A").trim().charAt(0).toUpperCase();
  return (
    <aside className="hidden lg:flex flex-col w-[260px] shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-6 pt-7 pb-6">
        <Logo variant="light" />
      </div>

      <div className="px-4 mt-2">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-secondary-soft">{t.chronos.nav.cycle} {cycle.number} · {t.chronos.nav.week_short} {cycle.week}</div>
          <div className="font-display text-lg text-primary-foreground mt-1">{cycle.name}</div>
          <div className="mt-3 h-1.5 rounded-full bg-sidebar-border overflow-hidden">
            <div className="h-full bg-bronze" style={{ width: `${Math.round(cycle.progress * 100)}%` }} />
          </div>
          <div className="text-[11px] text-sidebar-foreground/70 mt-1.5 num">{Math.round(cycle.progress * 100)}% {t.chronos.nav.arcCompleted}</div>
        </div>
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

      <div className="p-4">
        <div className="rounded-lg bg-sidebar-accent/50 border border-sidebar-border p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-bronze grid place-items-center text-primary-deep font-display font-semibold">{initial}</div>
          <div className="min-w-0">
            <div className="text-sm text-sidebar-accent-foreground truncate">{session?.name ?? data.meta.owner}</div>
            <div className="text-[11px] text-sidebar-foreground/60 truncate">{session?.email ?? t.chronos.settings.composer}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
