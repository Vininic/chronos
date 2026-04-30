import { Search, Bell, LogOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ComposeBlockDialog } from "./ComposeBlockDialog";
import { useSchedule } from "@/lib/schedule/store";
import { DAY_LABELS } from "@/lib/schedule/types";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Topbar() {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const { data } = useSchedule();
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const r = data.routine.filter((x) => x.title.toLowerCase().includes(term)).slice(0, 5).map((x) => ({
      id: x.id, label: x.title, sub: `${DAY_LABELS[x.day]} · ${x.start}–${x.end}`, kind: "routine" as const,
    }));
    const c = data.commitments.filter((x) => x.title.toLowerCase().includes(term)).slice(0, 5).map((x) => ({
      id: x.id, label: x.title, sub: `${x.date} · ${x.start}–${x.end}`, kind: "commitment" as const,
    }));
    const s = data.suggestions.filter((x) => x.title.toLowerCase().includes(term)).slice(0, 3).map((x) => ({
      id: x.id, label: x.title, sub: x.impact, kind: "suggestion" as const,
    }));
    return [...r, ...c, ...s];
  }, [q, data]);

  function go(kind: string) {
    setOpen(false); setQ("");
    if (kind === "routine") navigate("/dashboard/week");
    else if (kind === "commitment") navigate("/dashboard/atlas");
    else navigate("/dashboard/aetheris");
  }

  return (
    <header className="h-16 border-b bg-card/70 backdrop-blur flex items-center px-6 gap-4 sticky top-0 z-10">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Today</div>
        <div className="font-display text-lg text-primary -mt-0.5">{today}</div>
      </div>
      <div ref={ref} className="flex-1 max-w-md ml-6 relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Search rituals, blocks, commitments…"
            className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
          />
        </div>
        {open && q && (
          <div className="absolute top-12 left-0 right-0 bg-card border border-border rounded-md shadow-elevated overflow-hidden z-20">
            {results.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground italic">Nothing in the ledger matches "{q}".</div>
            ) : results.map((r) => (
              <button key={`${r.kind}-${r.id}`} onClick={() => go(r.kind)} className="w-full text-left px-4 py-2.5 hover:bg-secondary/10 border-b border-border/60 last:border-b-0">
                <div className="text-sm text-primary truncate">{r.label}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span className="uppercase tracking-wider text-secondary">{r.kind}</span> · {r.sub}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-10 w-10 rounded-md border border-border bg-background grid place-items-center hover:bg-secondary/10 relative">
              <Bell className="h-4 w-4 text-primary" />
              {data.suggestions.length > 0 && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-secondary" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="font-display text-base">Aetheris notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {data.suggestions.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground italic">All quiet.</div>
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
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="font-display text-base text-primary">{session.name}</div>
                <div className="text-xs text-muted-foreground font-sans font-normal">{session.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { signOut(); navigate("/login"); }}>
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
