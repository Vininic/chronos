import { useEffect, useRef, useState } from "react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { durationMin } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Brain, Pause, Play, RotateCcw } from "lucide-react";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { toast } from "@/hooks/use-toast";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";

export default function Focus() {
  const { data } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const todays = buildAgendaForDate(data, new Date()).filter((a) => a.kind === "deep");
  const upcoming = data.routine.filter((r) => r.kind === "deep");
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(25 * 60);
  const [target, setTarget] = useState(25 * 60);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => {
      setSeconds((s) => { if (s <= 1) { window.clearInterval(ref.current!); setRunning(false); toast({ title: t.chronos.focus.sealed_done }); return 0; } return s - 1; });
    }, 1000);
    return () => { if (ref.current) window.clearInterval(ref.current); };
  }, [running, t]);
  function start(min: number) { setTarget(min * 60); setSeconds(min * 60); setRunning(true); }
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.focus.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.focus.lead}</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="chronos-card-elevated p-8 lg:col-span-2 grid place-items-center">
          <div className="text-center">
            <div className="font-display text-[120px] leading-none text-primary num">{mm}<span className="text-secondary">:</span>{ss}</div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mt-2">{t.chronos.focus.sealed}</div>
            <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
              {[25, 45, 60, 90].map((m) => (
                <Button key={m} variant={target === m * 60 ? "default" : "outline"} onClick={() => start(m)} className={target === m * 60 ? "bg-primary text-primary-foreground" : ""}>{m}m</Button>
              ))}
              <Button onClick={() => setRunning((r) => !r)} className="bg-bronze text-primary-deep hover:opacity-90">{running ? <><Pause className="h-4 w-4 mr-1" /> {t.chronos.focus.pause}</> : <><Play className="h-4 w-4 mr-1" /> {t.chronos.focus.begin}</>}</Button>
              <Button variant="outline" onClick={() => { setRunning(false); setSeconds(target); }}><RotateCcw className="h-4 w-4 mr-1" /> {t.chronos.focus.reset}</Button>
            </div>
          </div>
        </div>
        <div className="chronos-card p-6">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.todaysDepth}</div>
          <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.focus.composed(todays.length)}</h3>
          <ul className="mt-4 space-y-3">
            {todays.length === 0 && <li className="text-sm text-muted-foreground italic">{t.chronos.focus.noDeepToday}</li>}
            {todays.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center"><Brain className="h-4 w-4 text-secondary-soft" /></div>
                <div className="flex-1 min-w-0"><div className="text-sm text-primary truncate">{s.title}</div><div className="text-[11px] text-muted-foreground num">{s.start}–{s.end} · {fmtDur(durationMin(s.start, s.end))}</div></div>
              </li>
            ))}
          </ul>
          <div className="mt-5"><ComposeBlockDialog trigger={<Button variant="outline" className="w-full">{t.chronos.focus.addDeep}</Button>} defaultKind="deep" /></div>
        </div>
      </div>
      <section className="mt-8 chronos-card p-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.focus.recurringDepth}</div>
        <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.focus.recurringTitle}</h3>
        <table className="w-full mt-4 text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground"><tr className="border-b border-border"><th className="text-left py-2">{t.chronos.focus.tableDay}</th><th className="text-left">{t.chronos.focus.tableTitle}</th><th className="text-right">{t.chronos.focus.tableStart}</th><th className="text-right">{t.chronos.focus.tableEnd}</th><th className="text-right">{t.chronos.focus.tableDuration}</th></tr></thead>
          <tbody>
            {upcoming.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="py-2.5 text-muted-foreground">{t.common.days.short[r.day]}</td>
                <td className="text-primary">{r.title}</td>
                <td className="text-right num">{r.start}</td><td className="text-right num">{r.end}</td>
                <td className="text-right num text-secondary">{fmtDur(durationMin(r.start, r.end))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
