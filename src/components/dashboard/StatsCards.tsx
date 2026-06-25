import type { AgendaItem } from "@/lib/schedule/agenda";
import type { ScheduleData } from "@/lib/schedule/types";
import { timeToMinutes, durationMin, categoryRoleOf } from "@/lib/schedule/types";
import { safeKindStyle, TAILWIND_TO_HEX, alpha } from "./widgets";
import { useT } from "@/lib/i18n/I18nProvider";
import { Activity, Zap, Heart, ListChecks } from "lucide-react";

export function DayProgressCard({ agenda, categories, t, isPt }: {
  agenda: AgendaItem[];
  categories: ScheduleData["categories"];
  t: ReturnType<typeof useT>;
  isPt: boolean;
}) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const nonSleep = agenda.filter((a) => a.kind !== "sleep");
  const completed = nonSleep.filter((a) => timeToMinutes(a.end) <= nowMin).length;
  const total = nonSleep.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const slots = Array.from({ length: 24 }, (_, h) => {
    const slotStart = h * 60;
    const slotEnd = slotStart + 60;
    const covering = nonSleep.find((a) => timeToMinutes(a.start) < slotEnd && timeToMinutes(a.end) > slotStart);
    if (!covering) return null;
    const s = safeKindStyle(covering.kind, categories);
    const hex = s.customColor ?? TAILWIND_TO_HEX[s.dot] ?? undefined;
    return hex ? alpha(hex, "80") : "hsl(var(--muted-foreground) / 0.35)";
  });

  return (
    <div className="chronos-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-secondary" />
        <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">{isPt ? "Progresso do dia" : "Day progress"}</span>
      </div>
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: "hsl(var(--secondary))" }} />
          </div>
          <span className="text-xs text-primary font-medium num">{pct}%</span>
        </div>
        <div className="text-[10px] text-muted-foreground">{completed}/{total} {isPt ? "blocos concluídos" : "blocks done"}</div>
      </div>
      <div className="flex items-end gap-px h-5 mt-1">
        {slots.map((color, h) => (
          <div key={h} className="flex-1 rounded-sm" style={{ height: color ? "100%" : "40%", backgroundColor: color ?? "hsl(var(--muted-foreground) / 0.15)" }} title={`${String(h).padStart(2, "0")}:00`} />
        ))}
      </div>
      <div className="flex justify-between text-[8px] text-muted-foreground/50">
        <span>00:00</span>
        <span>12:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

export function FocusRecoveryCard({ agenda, categories, t, isPt }: {
  agenda: AgendaItem[];
  categories: ScheduleData["categories"];
  t: ReturnType<typeof useT>;
  isPt: boolean;
}) {
  const nonSleep = agenda.filter((a) => a.kind !== "sleep");
  let focusMin = 0, recoveryMin = 0, neutralMin = 0;
  nonSleep.forEach((a) => {
    const dur = durationMin(a.start, a.end);
    const role = categoryRoleOf(categories, a.kind);
    if (role === "focus") focusMin += dur;
    else if (role === "recovery") recoveryMin += dur;
    else neutralMin += dur;
  });
  const totalMin = focusMin + recoveryMin + neutralMin || 1;
  const fmtMin = (m: number) => `${Math.round(m / 60 * 10) / 10}h`;

  return (
    <div className="chronos-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-secondary" />
        <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">{isPt ? "Foco vs Recuperação" : "Focus vs Recovery"}</span>
      </div>
      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-secondary" /><span className="text-muted-foreground">{isPt ? "Foco" : "Focus"}</span></span>
            <span className="num text-primary">{fmtMin(focusMin)} · {totalMin > 0 ? Math.round(focusMin / totalMin * 100) : 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${totalMin > 0 ? focusMin / totalMin * 100 : 0}%`, backgroundColor: "hsl(var(--secondary))" }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5"><Heart className="h-3 w-3 text-rose-400" /><span className="text-muted-foreground">{isPt ? "Recuperação" : "Recovery"}</span></span>
            <span className="num text-primary">{fmtMin(recoveryMin)} · {totalMin > 0 ? Math.round(recoveryMin / totalMin * 100) : 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-rose-400/60" style={{ width: `${totalMin > 0 ? recoveryMin / totalMin * 100 : 0}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-muted-foreground/30" /><span className="text-muted-foreground">{isPt ? "Outros" : "Other"}</span></span>
            <span className="num text-primary">{fmtMin(neutralMin)} · {totalMin > 0 ? Math.round(neutralMin / totalMin * 100) : 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-muted-foreground/20" style={{ width: `${totalMin > 0 ? neutralMin / totalMin * 100 : 0}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AgendaStatsCard({ agenda, categories, t, isPt }: {
  agenda: AgendaItem[];
  categories: ScheduleData["categories"];
  t: ReturnType<typeof useT>;
  isPt: boolean;
}) {
  const nonSleep = agenda.filter((a) => a.kind !== "sleep");
  const totalBlocks = nonSleep.length;
  const focusMin = nonSleep.reduce((s, a) => {
    const role = categoryRoleOf(categories, a.kind);
    return role === "focus" ? s + durationMin(a.start, a.end) : s;
  }, 0);
  const sorted = [...nonSleep].sort((a, b) => a.start.localeCompare(b.start));
  let freeSlots = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = timeToMinutes(sorted[i].start) - timeToMinutes(sorted[i - 1].end);
    if (gap >= 30) freeSlots++;
  }

  return (
    <div className="chronos-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-secondary" />
        <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">{isPt ? "Resumo" : "Summary"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 flex-1 items-center">
        <div className="text-center">
          <div className="text-lg font-display text-primary">{totalBlocks}</div>
          <div className="text-[10px] text-muted-foreground">{isPt ? "Blocos" : "Blocks"}</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-display text-primary">{Math.round(focusMin / 6) / 10}h</div>
          <div className="text-[10px] text-muted-foreground">{isPt ? "Foco" : "Focus"}</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-display text-primary">{freeSlots}</div>
          <div className="text-[10px] text-muted-foreground">{isPt ? "Janelas" : "Gaps"}</div>
        </div>
      </div>
    </div>
  );
}
