import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeSelect } from "@/components/ui/time-select";
import { Plus, Trash2 } from "lucide-react";
import { useT, useI18n, useFmtDur } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind, durationMin } from "@/lib/schedule/types";
import { fmtFriendlyDuration } from "@/lib/schedule/planner-format";
import { parseNotes, serializeNotes, noteToneStyles } from "@/lib/schedule/planner-notes";
import type { NoteLine, NoteTone } from "@/lib/schedule/planner-notes";
import { isKnownDefaultBlockTitle } from "@/lib/i18n/scheduleText";
import { SessionView } from "../SessionView";
import type { AgendaItem } from "@/lib/schedule/agenda";

export function BlockEditDialog({
  item,
  categories,
  onSave,
  onRemove,
  onClose,
}: {
  item: AgendaItem;
  categories: { id: string; label: string; labelCustom?: string }[];
  onSave: (patch: Partial<AgendaItem> & { titleCustom?: string; endsNextDay?: boolean }) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const { data } = useSchedule();
  const [title, setTitle] = useState(scheduleText.blockTitle(item.title, item.titleCustom));
  const [kind, setKind] = useState<BlockKind>(item.kind);
  const [start, setStart] = useState(item.start);
  const [end, setEnd] = useState(item.end);
  const [endsNextDay, setEndsNextDay] = useState(Boolean(item.continuesToNextDay) || end <= start);
  const [noteLines, setNoteLines] = useState<NoteLine[]>(() => parseNotes(item.notes));
  const [editWorkspace, setEditWorkspace] = useState<Record<string, unknown>>(() => item.workspace ?? {});
  const dur = durationMin(start, end);

  useEffect(() => {
    if (end <= start) setEndsNextDay(true);
  }, [start, end]);

  const toneOptions: { value: NoteTone; label: string }[] = [
    { value: "amber", label: "Amber" },
    { value: "sky", label: "Sky" },
    { value: "emerald", label: "Emerald" },
    { value: "rose", label: "Rose" },
    { value: "violet", label: "Violet" },
  ];

  function addNoteLine() {
    setNoteLines((prev) => [...prev, { text: "", tone: "amber" }]);
  }

  function updateNoteText(index: number, text: string) {
    setNoteLines((prev) => prev.map((note, i) => (i === index ? { ...note, text } : note)));
  }

  function updateNoteTone(index: number, tone: NoteTone) {
    setNoteLines((prev) => prev.map((note, i) => (i === index ? { ...note, tone } : note)));
  }

  function removeNoteLine(index: number) {
    setNoteLines((prev) => prev.filter((_, i) => i !== index));
  }

  function save() {
    const next = title.trim();
    if (!next) return;
    const defaultTitle = scheduleText.blockTitle(item.title);
    const extData = Object.keys(editWorkspace).length > 0 ? editWorkspace : undefined;
    const patch: Partial<AgendaItem> & { titleCustom?: string; endsNextDay?: boolean } = {
      start,
      end,
      kind,
      endsNextDay: endsNextDay || end <= start,
      notes: serializeNotes(noteLines),
      title: item.title,
      titleCustom: isKnownDefaultBlockTitle(item.title)
        ? (next !== defaultTitle ? next : undefined)
        : undefined,
      workspace: extData,
    };
    if (!isKnownDefaultBlockTitle(item.title)) {
      onSave({ ...patch, title: next });
    } else {
      onSave(patch);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[min(80vh,calc(100dvh-3rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">{scheduleText.blockTitle(item.title, item.titleCustom)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1 min-w-0">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.title_field}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.kind}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.filter((c) => c.id !== "sleep").map((c) => (
                  <SelectItem key={c.id} value={c.id}>{scheduleText.categoryLabel(c.id as BlockKind, c.label, c.labelCustom)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.start}</Label>
              <TimeSelect value={start} onValueChange={setStart} bcp47={bcp47} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.end}</Label>
              <TimeSelect value={end} onValueChange={setEnd} bcp47={bcp47} className="h-9" />
            </div>
          </div>
          <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-ends-next-day"
                checked={endsNextDay}
                onCheckedChange={(checked) => setEndsNextDay(checked === true)}
              />
              <Label htmlFor="edit-ends-next-day" className="text-[11px] text-muted-foreground">
                {bcp47.toLowerCase().startsWith("pt") ? "Termina no dia seguinte" : "Ends next day"}
              </Label>
            </div>
          </div>
          {dur > 0 && <p className="text-[11px] num text-secondary">{t.chronos.today.duration}: {fmtDur(dur)}</p>}
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.notes}</Label>
            {noteLines.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3">
                <button
                  type="button"
                  onClick={addNoteLine}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-secondary/40 px-2 py-1 text-[11px] text-secondary/80 hover:text-secondary hover:border-secondary"
                >
                  <Plus className="h-3 w-3" />
                  {bcp47.toLowerCase().startsWith("pt") ? "Adicionar nota" : "Add note"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {noteLines.map((line, index) => {
                  const tone = noteToneStyles[line.tone];
                  return (
                    <div key={`edit-note-${index}`} className={`relative rounded-md border p-2 pl-3 ${tone.border} ${tone.bg}`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${tone.solid}`} />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Input
                          value={line.text}
                          onChange={(e) => updateNoteText(index, e.target.value)}
                          placeholder={t.chronos.dialog.notesPlaceholder}
                          className="h-8 min-w-[100px] flex-1"
                        />
                        <Select value={line.tone} onValueChange={(v) => updateNoteTone(index, v as NoteTone)}>
                          <SelectTrigger className="h-8 w-16 text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {toneOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeNoteLine(index)} className="h-8 w-7 px-0 text-muted-foreground shrink-0">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addNoteLine}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-secondary/40 px-2 py-1 text-[11px] text-secondary/80 hover:text-secondary hover:border-secondary"
                >
                  <Plus className="h-3 w-3" />
                  {bcp47.toLowerCase().startsWith("pt") ? "Adicionar outra nota" : "Add another note"}
                </button>
              </div>
            )}
            {(() => {
              const cat = data.categories.find((c) => c.id === item.kind);
              const structure = cat?.workspace;
              if (!structure) return null;
              return (
                <div className="space-y-2 border-t border-border/30 pt-3">
                  <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {cat?.label ?? item.kind}
                  </Label>
                  <div className="overflow-x-auto min-w-0">
                    <SessionView
                    structure={structure}
                    runtime={editWorkspace}
                    onChange={(newExt) => setEditWorkspace(newExt)}
                    onClose={() => {}}
                  />
                </div>
                </div>
              );
            })()}
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
