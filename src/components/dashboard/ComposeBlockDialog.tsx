import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TimeSelect } from "@/components/ui/time-select";
import { Checkbox } from "@/components/ui/checkbox";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind, durationMin, timeToMinutes, CommitmentPriority, eisenhowerQuadrant, QUADRANT_COLORS, QUADRANT_LABELS } from "@/lib/schedule/types";
import { kindStyle } from "./widgets";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Bookmark, CalendarDays, StickyNote, Puzzle } from "lucide-react";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { getRegisteredExtensions } from "@/lib/extensions/registry";
import type { BlockExtension } from "@/lib/extensions/types";
import { getCustomFields } from "./BlockSchemaUI";

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

const DOT_HEX: Record<string, string> = {
  "bg-amber-500": "#f59e0b",
  "bg-blue-500": "#3b82f6",
  "bg-violet-500": "#8b5cf6",
  "bg-emerald-500": "#10b981",
  "bg-slate-400": "#94a3b8",
  "bg-indigo-400": "#818cf8",
  "bg-secondary": "#6b7280",
};

function addIsoDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDurationLabel(start: string, end: string, isPt: boolean) {
  const total = durationMin(start, end);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h > 0 && m > 0) return isPt ? `${h}h ${m}min` : `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return isPt ? `${m}min` : `${m}m`;
}

interface Props {
  trigger?: React.ReactNode;
  defaultKind?: BlockKind;
  defaultStart?: string;
  defaultEnd?: string;
  defaultDay?: number;
  defaultDateIso?: string;
  defaultMode?: "routine" | "commitment";
}

export function ComposeBlockDialog({
  trigger,
  defaultKind = "deep",
  defaultStart,
  defaultEnd,
  defaultDay,
  defaultDateIso,
  defaultMode,
}: Props) {
  const { data, addRoutine, addCommitment, addPreset } = useSchedule();
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
  const [routineEndsNextDay, setRoutineEndsNextDay] = useState(false);
  const [commitmentEndsNextDay, setCommitmentEndsNextDay] = useState(false);
  const [noteLines, setNoteLines] = useState<NoteLine[]>([]);
  const [hasDate, setHasDate] = useState(true);
  const [looseDuration, setLooseDuration] = useState(60);
  const [commitmentUrgent, setCommitmentUrgent] = useState(false);
  const [commitmentImportant, setCommitmentImportant] = useState(false);
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});

  function getDefaultExtensionData(ext: BlockExtension) {
    const defaults: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(ext.schema)) {
      if (def.defaultValue !== undefined) defaults[key] = def.defaultValue;
    }
    return defaults;
  }

  function toggleExtension(ext: BlockExtension) {
    setExtensions((prev) => {
      if (prev[ext.id]) {
        const next = { ...prev };
        delete next[ext.id];
        return next;
      }
      return { ...prev, [ext.id]: getDefaultExtensionData(ext) };
    });
  }

  function updateExtensionData(id: string, data: unknown) {
    setExtensions((prev) => ({ ...prev, [id]: data }));
  }

  const DURATION_OPTIONS = [
    { value: 15, label: "15m" },
    { value: 30, label: "30m" },
    { value: 45, label: "45m" },
    { value: 60, label: "1h" },
    { value: 90, label: "1h30" },
    { value: 120, label: "2h" },
    { value: 180, label: "3h" },
    { value: 240, label: "4h" },
  ];

  // Sync end from looseDuration when undated
  useEffect(() => {
    if (mode !== "commitment" || hasDate) return;
    const startMin = timeToMinutes("09:00");
    const endMin = startMin + looseDuration;
    const h = Math.floor(endMin / 60);
    const m = endMin % 60;
    setStart("09:00");
    setEnd(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }, [looseDuration, hasDate, mode]);

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
    setRoutineEndsNextDay(false);
    setCommitmentEndsNextDay(false);
    setLooseDuration(60);
    setCommitmentUrgent(false);
    setCommitmentImportant(false);
    setSaveAsPreset(false);
    setExtensions({});
  }

  useEffect(() => {
    if (!open) return;
    const baseDate = defaultDateIso ?? new Date().toISOString().slice(0, 10);
    setMode(defaultMode ?? "routine");
    setDay(String(defaultDay ?? new Date().getDay()));
    setDate(baseDate);
    setEndDate(baseDate);
    setRoutineEndsNextDay(false);
    setCommitmentEndsNextDay(false);
    setLooseDuration(60);
    setCommitmentUrgent(false);
    setCommitmentImportant(false);
    setSaveAsPreset(false);
    setExtensions({});
  }, [open, defaultDateIso, defaultDay, defaultEnd, defaultKind, defaultStart, defaultMode]);

  useEffect(() => {
    if (end <= start) {
      setRoutineEndsNextDay(true);
      setCommitmentEndsNextDay(true);
    }
  }, [start, end]);

  useEffect(() => {
    if (mode !== "commitment") return;
    if (commitmentEndsNextDay && endDate <= date) {
      setEndDate(addIsoDays(date, 1));
    }
    if (!commitmentEndsNextDay && endDate !== date) {
      setEndDate(date);
    }
  }, [mode, commitmentEndsNextDay, date, endDate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast({ title: t.chronos.dialog.needsTitle }); return; }
    const isPt = bcp47.toLowerCase().startsWith("pt");
    const extData = Object.keys(extensions).length > 0 ? extensions : undefined;
    if (mode === "routine") {
      const endsNextDay = routineEndsNextDay || end <= start;
      const error = addRoutine({ day: Number(day), start, end, endsNextDay, kind, title: title.trim(), notes: serializeNotes(noteLines), extensions: extData });
      if (error) {
        toast({ title: "Scheduling conflict", description: error });
        return;
      }
      toast({ title: t.chronos.dialog.routineAdded, description: `${t.common.days.long[Number(day)]} · ${start}–${end}${endsNextDay ? ` (${isPt ? "amanhã" : "tomorrow"})` : ""}` });
    } else {
      const commitmentDate = hasDate ? date : undefined;
      const effectiveEndsNextDay = commitmentDate ? (commitmentEndsNextDay || end <= start) : (end <= start);
      const priority: CommitmentPriority = { urgent: commitmentUrgent, important: commitmentImportant };
      const normalizedEndDate = effectiveEndsNextDay && commitmentDate ? (endDate > date ? endDate : addIsoDays(date, 1)) : undefined;
      const error = addCommitment({ date: commitmentDate, start, end, endDate: normalizedEndDate, endsNextDay: effectiveEndsNextDay, kind, title: title.trim(), notes: serializeNotes(noteLines), priority, extensions: extData });
      if (error) {
        toast({ title: "Scheduling conflict", description: error });
        return;
      }
      if (saveAsPreset) {
        addPreset({ title: title.trim(), titleCustom: undefined, kind, duration: hasDate ? durationMin(start, end) : looseDuration, notes: serializeNotes(noteLines), priority: { urgent: commitmentUrgent, important: commitmentImportant }, extensions: extData });
      }
      toast({
        title: t.chronos.dialog.commitmentAdded,
        description: hasDate ? `${date} · ${start}–${end}${effectiveEndsNextDay ? ` (${isPt ? "amanhã" : "tomorrow"})` : ""}` : (isPt ? "Compromisso solto" : "Loose commitment"),
      });
    }
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <style>{`.kind-hover-item[data-highlighted] { background-color: var(--kind-hover) !important; }`}</style>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-9 bg-primary text-primary-foreground hover:bg-primary-deep">
            <Plus className="h-4 w-4 mr-1" /> {t.common.composeBlock}
          </Button>
        )}
      </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">{t.chronos.dialog.title}</DialogTitle>
          <DialogDescription>{t.chronos.dialog.desc}</DialogDescription>
          {(() => {
            const fields = getCustomFields(data, kind);
            if (!fields || fields.length === 0) return null;
            const cat = data.categories.find((c) => c.id === kind);
            const localePt = bcp47.toLowerCase().startsWith("pt");
            return (
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-muted/30 px-2.5 py-1.5">
                <StickyNote className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground">
                  {localePt
                    ? `${fields.length} campo(s) — preencha clicando no selo do bloco depois de criá-lo.`
                    : `${fields.length} field(s) — fill in by clicking the block's badge after creating it.`}
                </span>
              </div>
            );
          })()}
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
              <div className={`space-y-1.5 ${mode === "commitment" ? "pt-10" : ""}`}>
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.kind}</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}>
                  <SelectTrigger>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${kindStyle[kind]?.dot ?? "bg-secondary"}`} />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {data.categories.filter((c) => c.id !== "sleep").map((c) => {
                      const s = kindStyle[c.id as BlockKind];
                      const dotClass = s?.dot ?? "bg-secondary";
                      const hex = DOT_HEX[dotClass] ?? DOT_HEX["bg-secondary"];
                      return (
                        <SelectItem key={c.id} value={c.id}
                          className="kind-hover-item"
                          style={{ "--kind-hover": `${hex}22` } as React.CSSProperties}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                            {scheduleText.categoryLabel(c.id, c.label || t.common.kinds[c.id], c.labelCustom)}
                          </span>
                        </SelectItem>
                      );
                    })}
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHasDate(true)}
                    className={`flex-1 rounded-md border px-3 py-2 text-[11px] font-medium transition-colors text-center ${
                      hasDate
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground/60 hover:border-secondary/40"
                    }`}
                  >
                    {bcp47.toLowerCase().startsWith("pt") ? "Com data" : "On a date"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasDate(false)}
                    className={`flex-1 rounded-md border px-3 py-2 text-[11px] font-medium transition-colors text-center ${
                      !hasDate
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground/60 hover:border-secondary/40"
                    }`}
                  >
                    {bcp47.toLowerCase().startsWith("pt") ? "Soltos" : "Loose"}
                  </button>
                </div>
                {hasDate ? (
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setLooseDuration(opt.value)}
                          className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                            looseDuration === opt.value
                              ? "border-primary/60 bg-primary/10 text-primary"
                              : "border-border/60 text-muted-foreground/70 hover:border-secondary/40 hover:text-secondary"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 num">
                      {DURATION_OPTIONS.find(o => o.value === looseDuration)?.label}
                    </p>
                  </>
                )}
              </TabsContent>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {mode === "commitment" && !hasDate ? null : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.start}</Label>
                    <TimeSelect value={start} onValueChange={setStart} bcp47={bcp47} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.end}</Label>
                    <TimeSelect value={end} onValueChange={setEnd} bcp47={bcp47} />
                  </div>
                </>
              )}
            </div>
            {mode === "commitment" && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{bcp47.toLowerCase().startsWith("pt") ? "Prioridade" : "Priority"}</Label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCommitmentUrgent(!commitmentUrgent)}
                    className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      commitmentUrgent
                        ? "border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400"
                        : "text-muted-foreground/70 hover:bg-red-500/5 hover:text-red-500/70"
                    }`}
                  >
                    {bcp47.toLowerCase().startsWith("pt") ? "Urgente" : "Urgent"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommitmentImportant(!commitmentImportant)}
                    className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      commitmentImportant
                        ? "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground/70 hover:bg-blue-500/5 hover:text-blue-500/70"
                    }`}
                  >
                    {bcp47.toLowerCase().startsWith("pt") ? "Importante" : "Important"}
                  </button>
                </div>
              </div>
            )}
            {mode === "commitment" && (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Bookmark className="h-4 w-4 text-amber-500/70" />
                    <div>
                      <Label htmlFor="save-as-preset-switch" className="text-[11px] font-medium text-amber-500/90 cursor-pointer">
                        {bcp47.toLowerCase().startsWith("pt") ? "Salvar como modelo" : "Save as preset"}
                      </Label>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {bcp47.toLowerCase().startsWith("pt")
                          ? "Reutilize este compromisso como um modelo arrastável"
                          : "Reuse this commitment as a draggable template"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="save-as-preset-switch"
                    checked={saveAsPreset}
                    onCheckedChange={setSaveAsPreset}
                    className="data-[state=checked]:bg-amber-500/70"
                  />
                </div>
              </div>
            )}
            {!(mode === "commitment" && !hasDate) && (
              <div className="rounded-md border border-sky-500/20 bg-sky-500/[0.04] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 text-sky-500/70" />
                    <div>
                      <Label htmlFor="ends-next-day-switch" className="text-[11px] font-medium text-sky-500/90 cursor-pointer">
                        {bcp47.toLowerCase().startsWith("pt") ? "Termina no dia seguinte" : "Ends next day"}
                      </Label>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {mode === "commitment" && hasDate
                          ? (bcp47.toLowerCase().startsWith("pt")
                              ? "Definir uma data de término separada"
                              : "Set a separate end date")
                          : (bcp47.toLowerCase().startsWith("pt")
                              ? `Duração: ${formatDurationLabel(start, end, true)}`
                              : `Duration: ${formatDurationLabel(start, end, false)}`)}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="ends-next-day-switch"
                    checked={mode === "routine" ? routineEndsNextDay : commitmentEndsNextDay}
                    onCheckedChange={(next) => {
                      if (mode === "routine") setRoutineEndsNextDay(next);
                      else setCommitmentEndsNextDay(next);
                    }}
                    className="data-[state=checked]:bg-sky-500/70"
                  />
                </div>
                {mode === "commitment" && hasDate && commitmentEndsNextDay && (
                  <div className="mt-2.5 pt-2.5 border-t border-sky-500/10">
                    <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {bcp47.toLowerCase().startsWith("pt") ? "Data de término" : "End date"}
                    </Label>
                    <Input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
                  </div>
                )}
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
                    <p className="text-[10px] text-muted-foreground/60 num mt-1">
                      {DURATION_OPTIONS.find(o => o.value === looseDuration)?.label}
                    </p>
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
            {getRegisteredExtensions().length > 0 && (
              <div className="space-y-2 border-t border-border/30 pt-3">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                  <Puzzle className="h-3 w-3" />
                  {bcp47.toLowerCase().startsWith("pt") ? "Extens\u00f5es" : "Extensions"}
                </Label>
                <div className="space-y-2">
                  {getRegisteredExtensions().map((ext) => {
                    const isActive = !!extensions[ext.id];
                    return (
                      <div key={ext.id} className={`rounded-md border p-2.5 transition-colors ${isActive ? "border-secondary/40 bg-muted/20" : "border-border/40"}`}>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggleExtension(ext)}
                            id={`ext-${ext.id}`}
                          />
                          <Label htmlFor={`ext-${ext.id}`} className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer">
                            <ext.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {ext.label}
                          </Label>
                        </div>
                        {isActive && ext.renderEditor && (
                          <div className="mt-2 ml-0 border-t border-border/20 pt-2">
                            {ext.renderEditor(extensions[ext.id], (next) => updateExtensionData(ext.id, next))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
