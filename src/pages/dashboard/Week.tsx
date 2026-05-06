import { WeeklyRoutine, kindStyle } from "@/components/dashboard/widgets";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind, durationMin } from "@/lib/schedule/types";
import { exportToICS, exportToXLSX } from "@/lib/schedule/export";
import { Button } from "@/components/ui/button";
import { Download, CalendarDays, Trash2, ArrowLeftRight, Plus, Minus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useFmtDur, useT, useI18n } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function toTime(min: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 45, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function Week() {
  const { data, removeRoutine, updateRoutine } = useSchedule();
  const t = useT();
  const { locale } = useI18n();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  // Mon=1..Sun=0, same order as the weekly grid
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const byDay = DAY_ORDER.map((di) => ({ di, blocks: data.routine.filter((r) => r.day === di).sort((a, b) => a.start.localeCompare(b.start)) }));

  function patchRoutine(id: string, patch: Record<string, unknown>, successTitle = t.common.save) {
    const err = updateRoutine(id, patch);
    if (err) {
      toast({ title: t.chronos.weekPage.schedulingConflict, description: err });
      return;
    }
    toast({ title: successTitle });
  }

  function shiftBlock(id: string, start: string, end: string, delta: number) {
    const s = toMin(start) + delta;
    const e = toMin(end) + delta;
    if (s < 0 || e > 24 * 60) return;
    patchRoutine(id, { start: toTime(s), end: toTime(e) }, t.chronos.weekPage.blockMoved);
  }

  function resizeBlock(id: string, start: string, end: string, delta: number) {
    const s = toMin(start);
    const e = toMin(end) + delta;
    if (e <= s || e > 24 * 60) return;
    patchRoutine(id, { end: toTime(e) }, t.chronos.weekPage.durationUpdated);
  }

  function moveDay(id: string, day: number, delta: number) {
    const nextDay = (day + delta + 7) % 7;
    patchRoutine(id, { day: nextDay }, t.chronos.weekPage.movedToAnotherDay);
  }

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
          <Button variant="outline" onClick={() => { exportToXLSX(data, "chronos-schedule.xlsx", locale); toast({ title: t.chronos.weekPage.xlsxExported }); }}><Download className="h-4 w-4 mr-1.5" /> {t.chronos.weekPage.exportXLSX}</Button>
          <ComposeBlockDialog />
        </div>
      </header>
      <div className="grid grid-cols-1 gap-6"><WeeklyRoutine editable /></div>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {byDay.map(({ di, blocks }) => (
          <div key={di} className="chronos-card p-5">
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.common.days.long[di]}</div>
            <div className="font-display text-lg text-primary mt-0.5">{t.chronos.weekPage.blocks(blocks.length)}</div>
            <ul className="mt-3 space-y-2">
              {blocks.length === 0 && <li className="text-xs text-muted-foreground italic">{t.chronos.weekPage.empty}</li>}
              {blocks.map((b) => (
                <li key={b.id} className="group rounded-md border border-border/60 bg-surface-raised p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${kindStyle[b.kind as BlockKind].dot}`} />
                  <span className="text-primary truncate flex-1">{scheduleText.blockTitle(b.title, b.titleCustom)}</span>
                  <span className="text-[11px] text-muted-foreground num">{b.start} · {fmtDur(durationMin(b.start, b.end))}</span>
                  <button onClick={() => { removeRoutine(b.id); toast({ title: t.chronos.weekPage.blockRemoved }); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                    <Button size="sm" variant="outline" className="h-7" onClick={() => shiftBlock(b.id, b.start, b.end, -15)}>
                      <Minus className="h-3 w-3 mr-1" /> 15m
                    </Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => shiftBlock(b.id, b.start, b.end, 15)}>
                      <Plus className="h-3 w-3 mr-1" /> 15m
                    </Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => resizeBlock(b.id, b.start, b.end, 15)}>
                      <ArrowLeftRight className="h-3 w-3 mr-1" /> +15m
                    </Button>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
                    <Button size="sm" variant="outline" className="h-7" onClick={() => moveDay(b.id, b.day, -1)}>
                      <ChevronLeft className="h-3 w-3 mr-1" /> {t.chronos.weekPage.previousDay}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7" onClick={() => moveDay(b.id, b.day, 1)}>
                      {t.chronos.weekPage.nextDay} <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
