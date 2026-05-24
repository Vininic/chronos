import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimeSelect } from "@/components/ui/time-select";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind } from "@/lib/schedule/types";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";

type NoteTone = "amber" | "sky" | "emerald" | "rose" | "violet";

type NoteLine = {
  text: string;
  tone: NoteTone;
};

const noteToneAccent: Record<NoteTone, string> = {
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
};

function serializeNotes(lines: NoteLine[]) {
  return lines
    .map((line) => ({ text: line.text.trim(), tone: line.tone }))
    .filter((line) => line.text.length > 0)
    .map((line) => (line.tone === "amber" ? line.text : `${line.tone}: ${line.text}`))
    .join("\n");
}

interface Props {
  trigger?: React.ReactNode;
  defaultKind?: BlockKind;
  defaultStart?: string;
  defaultEnd?: string;
  defaultDay?: number;
  defaultDateIso?: string;
}

export function ComposeBlockDialog({
  trigger,
  defaultKind = "deep",
  defaultStart,
  defaultEnd,
  defaultDay,
  defaultDateIso,
}: Props) {
  const { data, addRoutine, addCommitment } = useSchedule();
  const t = useT();
  const { bcp47 } = useI18n();
  const scheduleText = useScheduleText();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"routine" | "commitment">("routine");
  const [kind, setKind] = useState<BlockKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(String(defaultDay ?? new Date().getDay()));
  const [date, setDate] = useState(defaultDateIso ?? new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState(defaultStart ?? "09:00");
  const [end, setEnd] = useState(defaultEnd ?? "10:00");
  const [endDate, setEndDate] = useState(defaultDateIso ?? new Date().toISOString().slice(0, 10));
  const [noteLines, setNoteLines] = useState<NoteLine[]>([]);

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

  function reset() {
    const baseDate = defaultDateIso ?? new Date().toISOString().slice(0, 10);
    setTitle("");
    setNoteLines([]);
    setStart(defaultStart ?? "09:00");
    setEnd(defaultEnd ?? "10:00");
    setKind(defaultKind);
    setDay(String(defaultDay ?? new Date().getDay()));
    setDate(baseDate);
    setEndDate(baseDate);
  }

  useEffect(() => {
    if (!open) return;
    const baseDate = defaultDateIso ?? new Date().toISOString().slice(0, 10);
    setDay(String(defaultDay ?? new Date().getDay()));
    setDate(baseDate);
    setEndDate(baseDate);
    setStart(defaultStart ?? "09:00");
    setEnd(defaultEnd ?? "10:00");
    setKind(defaultKind);
  }, [open, defaultDateIso, defaultDay, defaultEnd, defaultKind, defaultStart]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast({ title: t.chronos.dialog.needsTitle }); return; }
    if (mode === "routine") {
      const endsNextDay = end <= start;
      const error = addRoutine({ day: Number(day), start, end, endsNextDay, kind, title: title.trim(), notes: serializeNotes(noteLines) });
      if (error) {
        toast({ title: "Scheduling conflict", description: error });
        return;
      }
      toast({ title: t.chronos.dialog.routineAdded, description: `${t.common.days.long[Number(day)]} · ${start}–${end}${endsNextDay ? " (+1d)" : ""}` });
    } else {
      const endsNextDay = endDate > date || end <= start;
      const error = addCommitment({ date, start, end, endDate: endsNextDay ? endDate : undefined, endsNextDay, kind, title: title.trim(), notes: serializeNotes(noteLines) });
      if (error) {
        toast({ title: "Scheduling conflict", description: error });
        return;
      }
      toast({
        title: t.chronos.dialog.commitmentAdded,
        description: `${date} · ${start}–${end}${endsNextDay ? " (+1d)" : ""}`,
      });
    }
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-9 bg-primary text-primary-foreground hover:bg-primary-deep">
            <Plus className="h-4 w-4 mr-1" /> {t.common.composeBlock}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">{t.chronos.dialog.title}</DialogTitle>
          <DialogDescription>{t.chronos.dialog.desc}</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="routine">{t.chronos.dialog.tabRoutine}</TabsTrigger>
            <TabsTrigger value="commitment">{t.chronos.dialog.tabCommitment}</TabsTrigger>
          </TabsList>
          <form onSubmit={submit} className="space-y-4 mt-5">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.title_field}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.chronos.dialog.titlePlaceholder} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.kind}</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {data.categories.filter((c) => c.id !== "sleep").map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {scheduleText.categoryLabel(c.id, c.label || t.common.kinds[c.id], c.labelCustom)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TabsContent value="routine" className="m-0 space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.day}</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {t.common.days.long.map((d, i) => (<SelectItem key={d} value={String(i)}>{d}</SelectItem>))}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="commitment" className="m-0 space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.date}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </TabsContent>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.start}</Label>
                <TimeSelect value={start} onValueChange={setStart} bcp47={bcp47} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.end}</Label>
                <TimeSelect value={end} onValueChange={setEnd} bcp47={bcp47} />
              </div>
            </div>
            {mode === "commitment" && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {bcp47.toLowerCase().startsWith("pt") ? "Data de término" : "End date"}
                </Label>
                <Input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.notes}</Label>
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
                  {noteLines.map((line, index) => (
                    <div key={`compose-note-${index}`} className="relative rounded-md border border-border/60 bg-muted/20 p-2 pl-3">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${noteToneAccent[line.tone]}`} />
                      <div className="flex items-center gap-2">
                        <Input
                          value={line.text}
                          onChange={(e) => updateNoteText(index, e.target.value)}
                          placeholder={t.chronos.dialog.notesPlaceholder}
                          className="h-8"
                        />
                        <Select value={line.tone} onValueChange={(v) => updateNoteTone(index, v as NoteTone)}>
                          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {toneOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeNoteLine(index)} className="h-8 w-8 px-0 text-muted-foreground">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
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
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.chronos.dialog.cancel}</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary-deep">{t.chronos.dialog.submit}</Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
