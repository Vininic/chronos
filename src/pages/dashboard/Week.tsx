import { useState } from "react";
import { WeeklyRoutine, kindStyle } from "@/components/dashboard/widgets";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind, RoutineBlock, durationMin } from "@/lib/schedule/types";
import { exportToICS, exportToXLSX } from "@/lib/schedule/export";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, CalendarDays, Trash2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useFmtDur, useT, useI18n } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/ui/time-select";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function Week() {
  const { data, removeRoutine, updateRoutine } = useSchedule();
  const t = useT();
  const { locale, bcp47 } = useI18n();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const [editItem, setEditItem] = useState<RoutineBlock | null>(null);
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

  function handleSave(item: RoutineBlock, patch: Partial<RoutineBlock>) {
    patchRoutine(item.id, patch, t.common.save);
    setEditItem(null);
  }

  function handleRemove(item: RoutineBlock) {
    removeRoutine(item.id);
    toast({ title: t.chronos.weekPage.blockRemoved });
    setEditItem(null);
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
      <div className="grid grid-cols-1 gap-6"><WeeklyRoutine /></div>
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
                  <button onClick={() => setEditItem(b)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground num">
                    {b.start}–{b.end}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {editItem && (
        <WeekBlockEditDialog
          item={editItem}
          categories={data.categories}
          onClose={() => setEditItem(null)}
          onRemove={() => handleRemove(editItem)}
          onSave={(patch) => handleSave(editItem, patch)}
        />
      )}
    </>
  );
}

function WeekBlockEditDialog({
  item,
  categories,
  onClose,
  onRemove,
  onSave,
}: {
  item: RoutineBlock;
  categories: { id: string; label: string; labelCustom?: string }[];
  onClose: () => void;
  onRemove: () => void;
  onSave: (patch: Partial<RoutineBlock>) => void;
}) {
  const t = useT();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const [title, setTitle] = useState(item.titleCustom ?? item.title);
  const [kind, setKind] = useState<BlockKind>(item.kind);
  const [day, setDay] = useState<number>(item.day);
  const [start, setStart] = useState(item.start);
  const [end, setEnd] = useState(item.end);
  const [notes, setNotes] = useState(item.notes ?? "");
  const duration = durationMin(start, end);

  function save() {
    if (!title.trim()) return;
    onSave({
      title: item.titleCustom ? item.title : title.trim(),
      titleCustom: item.titleCustom || item.title !== title.trim() ? title.trim() : undefined,
      kind,
      day,
      start,
      end,
      endsNextDay: end <= start,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">{scheduleText.blockTitle(item.title, item.titleCustom)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.title_field}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.kind}</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as BlockKind)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {scheduleText.categoryLabel(category.id as BlockKind, category.label, category.labelCustom)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.day}</Label>
              <Select value={String(day)} onValueChange={(value) => setDay(Number(value))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 0].map((value) => (
                    <SelectItem key={value} value={String(value)}>{t.common.days.long[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.start}</Label>
              <TimeSelect value={start} onValueChange={setStart} bcp47={bcp47} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.end}</Label>
              <TimeSelect value={end} onValueChange={setEnd} bcp47={bcp47} />
            </div>
          </div>
          {duration > 0 && <p className="text-[11px] num text-secondary">{t.chronos.today.duration}: {fmtDur(duration)}</p>}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.notes}</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.chronos.dialog.notesPlaceholder} className="resize-none" />
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />{t.chronos.today.removeBlock}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
            <Button size="sm" onClick={save}>{t.common.save}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
