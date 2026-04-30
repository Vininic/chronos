import { WeeklyRoutine, kindStyle } from "@/components/dashboard/widgets";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind, durationMin } from "@/lib/schedule/types";
import { exportToICS, exportToXLSX } from "@/lib/schedule/export";
import { Button } from "@/components/ui/button";
import { Download, CalendarDays, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";

export default function Week() {
  const { data, removeRoutine } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const byDay = Array.from({ length: 7 }, (_, i) => data.routine.filter((r) => r.day === i).sort((a, b) => a.start.localeCompare(b.start)));
  return (
    <>
      <header className="mb-7 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.weekPage.eyebrow}</div>
          <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.weekPage.title}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.weekPage.lead}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { exportToICS(data); toast({ title: t.chronos.weekPage.icsExported }); }}><CalendarDays className="h-4 w-4 mr-1.5" /> {t.chronos.weekPage.exportICS}</Button>
          <Button variant="outline" onClick={() => { exportToXLSX(data); toast({ title: t.chronos.weekPage.xlsxExported }); }}><Download className="h-4 w-4 mr-1.5" /> {t.chronos.weekPage.exportXLSX}</Button>
          <ComposeBlockDialog />
        </div>
      </header>
      <div className="grid grid-cols-1 gap-6"><WeeklyRoutine editable /></div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {byDay.map((rows, i) => (
          <div key={i} className="chronos-card p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.common.days.long[i]}</div>
            <div className="font-display text-lg text-primary mt-0.5">{t.chronos.weekPage.blocks(rows.length)}</div>
            <ul className="mt-3 space-y-2">
              {rows.length === 0 && <li className="text-xs text-muted-foreground italic">{t.chronos.weekPage.empty}</li>}
              {rows.map((b) => (
                <li key={b.id} className="group flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${kindStyle[b.kind as BlockKind].dot}`} />
                  <span className="text-primary truncate flex-1">{b.title}</span>
                  <span className="text-[11px] text-muted-foreground num">{b.start} · {fmtDur(durationMin(b.start, b.end))}</span>
                  <button onClick={() => { removeRoutine(b.id); toast({ title: t.chronos.weekPage.blockRemoved }); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
