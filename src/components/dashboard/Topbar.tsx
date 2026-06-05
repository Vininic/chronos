import { Search, Bell, LogOut, Download, Upload, CalendarDays, FileJson, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ComposeBlockDialog } from "./ComposeBlockDialog";
import { buildAgendaForDate, useSchedule } from "@/lib/schedule/store";
import { useAuth } from "@/lib/auth";
import { useDateFormat, useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { LanguageToggle } from "@/components/suite/LanguageToggle";
import { ThemeToggle } from "@/components/suite/ThemeToggle";
import { timeToMinutes } from "@/lib/schedule/types";
import { toast } from "@/hooks/use-toast";
import { exportToICS, exportToJSON, exportToXLSX } from "@/lib/schedule/export";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Topbar() {
  const { data } = useSchedule();
  const { session, signOut } = useAuth();
  const t = useT();
  const { locale } = useI18n();
  const fmt = useDateFormat();
  const scheduleText = useScheduleText();
  const today = fmt.long(new Date());
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [dueFocus, setDueFocus] = useState<{ title: string; start: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const remindedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const r = data.routine.filter((x) => {
      const localizedTitle = scheduleText.blockTitle(x.title, x.titleCustom).toLowerCase();
      return x.title.toLowerCase().includes(term) || localizedTitle.includes(term);
    }).slice(0, 5).map((x) => ({
      id: x.id, label: scheduleText.blockTitle(x.title, x.titleCustom), sub: `${t.common.days.short[x.day]} · ${x.start}–${x.end}`, kind: "routine" as const, kindLabel: t.chronos.nav.week,
    }));
    const c = data.commitments.filter((x) => {
      const localizedTitle = scheduleText.blockTitle(x.title, x.titleCustom).toLowerCase();
      return x.title.toLowerCase().includes(term) || localizedTitle.includes(term);
    }).slice(0, 5).map((x) => ({
      id: x.id, label: scheduleText.blockTitle(x.title, x.titleCustom), sub: `${fmt.fromISO(x.date)} · ${x.start}–${x.end}`, kind: "commitment" as const, kindLabel: t.chronos.nav.today,
    }));
    const s = data.suggestions.filter((x) => x.title.toLowerCase().includes(term)).slice(0, 3).map((x) => ({
      id: x.id, label: x.title, sub: x.impact, kind: "suggestion" as const, kindLabel: t.chronos.nav.aetheris,
    }));
    return [...r, ...c, ...s];
  }, [q, data, t, fmt, scheduleText]);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const todayIso = now.toISOString().slice(0, 10);
      const deepAgenda = buildAgendaForDate(data, now).filter((a) => a.kind === "deep");
      const due = deepAgenda.find((a) => {
        const diff = timeToMinutes(a.start) - nowMin;
        return diff >= 0 && diff <= 1;
      });

      if (!due) return;
      const reminderId = `${todayIso}-${due.id}`;
      if (remindedRef.current.has(reminderId)) return;
      remindedRef.current.add(reminderId);
      setDueFocus({ title: scheduleText.blockTitle(due.title, due.titleCustom), start: due.start });

      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => undefined);
      }
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(t.chronos.store.notification.focusDue, {
          body: t.chronos.store.notification.focusStartsAt(scheduleText.blockTitle(due.title, due.titleCustom), due.start),
        });
      }
      if (location.pathname !== "/dashboard/focus") {
        toast({ title: t.chronos.store.notification.focusDue, description: t.chronos.store.notification.focusStartsNow(scheduleText.blockTitle(due.title, due.titleCustom)) });
      }
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [data, location.pathname, scheduleText]);

  function go(kind: string) {
    setOpen(false); setQ("");
    if (kind === "routine") navigate("/dashboard/week");
    else if (kind === "commitment") navigate("/dashboard");
    else navigate("/dashboard/aetheris");
  }

  return (
    <header className="h-16 border-b bg-card/70 backdrop-blur flex items-center px-6 gap-4 sticky top-0 z-10">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.common.today}</div>
        <div className="font-display text-lg text-primary -mt-0.5">{today}</div>
      </div>
      <div ref={ref} className="flex-1 max-w-md ml-6 relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={t.common.search}
            className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
          />
        </div>
        {open && q && (
          <div className="absolute top-12 left-0 right-0 bg-card border border-border rounded-md shadow-elevated overflow-hidden z-20">
            {results.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground italic">{t.common.nothingMatches} "{q}".</div>
            ) : results.map((r) => (
              <button key={`${r.kind}-${r.id}`} onClick={() => go(r.kind)} className="w-full text-left px-4 py-2.5 hover:bg-secondary/10 border-b border-border/60 last:border-b-0">
                <div className="text-sm text-primary truncate">{r.label}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span className="uppercase tracking-wider text-secondary">{r.kindLabel}</span> · {r.sub}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {dueFocus && location.pathname !== "/dashboard/focus" && (
          <button
            onClick={() => {
              navigate("/dashboard/focus");
              setDueFocus(null);
            }}
            className="h-8 px-2.5 rounded-md bg-card text-foreground border border-secondary/35 hover:bg-secondary/10 text-xs font-medium shadow-sm"
          >
            Focus now · {dueFocus.start}
          </button>
        )}
        <LanguageToggle />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-10 w-10 rounded-md border border-border bg-background grid place-items-center hover:bg-secondary/10 relative">
              <Bell className="h-4 w-4 text-primary" />
              {data.suggestions.length > 0 && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-secondary" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="font-display text-base">{t.common.notifications}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {data.suggestions.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground italic">{t.common.allQuiet}</div>
            ) : data.suggestions.map((s) => (
              <DropdownMenuItem key={s.id} onClick={() => navigate("/dashboard/aetheris")} className="flex flex-col items-start gap-0.5 py-2">
                <div className="text-sm text-primary">{s.title}</div>
                <div className="text-[11px] text-muted-foreground">{s.impact}</div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ComposeBlockDialog />
        {session && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-10 w-10 rounded-full bg-bronze grid place-items-center text-primary-deep font-display font-semibold">
                {session.name.charAt(0)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                <div className="font-display text-base text-primary">{session.name}</div>
                <div className="text-[11px] text-muted-foreground">{scheduleText.cycleName(data.meta.cycle.name)} · #{data.meta.cycle.number}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-2">{t.chronos.settings.appearance}</div>
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm text-muted-foreground">{t.chronos.settings.languageLabel}</span>
                  <LanguageToggle />
                </div>
                <div className="flex items-center justify-between px-2">
                  <span className="text-sm text-muted-foreground">{t.chronos.settings.themeLabel}</span>
                  <ThemeToggle />
                </div>
              </div>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 space-y-1.5">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground px-2">{t.chronos.settings.export}</div>
                <div className="grid grid-cols-3 gap-1 px-2">
                  <Button size="sm" variant="outline" className="h-8 text-[10px] px-1" onClick={() => { exportToXLSX(data, "chronos-schedule.xlsx", locale); toast({ title: t.chronos.settings.xlsxExported }); }}><Download className="h-3 w-3 mr-0.5" /> XLSX</Button>
                  <Button size="sm" variant="outline" className="h-8 text-[10px] px-1" onClick={() => { exportToICS(data); toast({ title: t.chronos.settings.icsExported }); }}><CalendarDays className="h-3 w-3 mr-0.5" /> ICS</Button>
                  <Button size="sm" variant="outline" className="h-8 text-[10px] px-1" onClick={() => { exportToJSON(data); toast({ title: t.chronos.settings.jsonExported }); }}><FileJson className="h-3 w-3 mr-0.5" /> JSON</Button>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { signOut(); navigate("/login"); }}>
                <LogOut className="h-4 w-4 mr-2" /> {t.common.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
