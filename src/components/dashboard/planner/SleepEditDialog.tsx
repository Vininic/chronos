import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TimeSelect } from "@/components/ui/time-select";
import { Plus, Trash2 } from "lucide-react";
import { useT, useI18n } from "@/lib/i18n/I18nProvider";
import { timeToMinutes, SNAP } from "@/lib/schedule/types";
import type { SleepCut } from "@/lib/schedule/types";
import { formatClock, fmtFriendlyDuration } from "@/lib/schedule/planner-format";

export function SleepEditDialog({
  sleepWindow,
  dayLabel,
  dateIso: _dateIso,
  sleepCuts,
  onSaveWindow,
  onAddOrUpdateSleepCut,
  onRemoveSleepCut,
  onClose,
}: {
  sleepWindow: { start: string; end: string; days?: number[] };
  dayLabel: string;
  dateIso: string;
  sleepCuts: SleepCut[];
  onSaveWindow: (patch: { start: string; end: string; applyToAllDays: boolean }) => void;
  onAddOrUpdateSleepCut: (cut: { start: string; end: string; previous?: { date: string; start?: string; end?: string } }) => void;
  onRemoveSleepCut: (target: { date: string; start?: string; end?: string }) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const isPt = bcp47.toLowerCase().startsWith("pt");

  const [start, setStart] = useState(
    sleepWindow.start === "00:00" || sleepWindow.start === "24:00" ? "24:00" : sleepWindow.start,
  );
  const [end, setEnd] = useState(sleepWindow.end === "24:00" ? "07:00" : sleepWindow.end);
  const [hasSleepStart, setHasSleepStart] = useState(
    sleepWindow.start !== "00:00" && sleepWindow.start !== sleepWindow.end,
  );
  const [hasWakeTime, setHasWakeTime] = useState(
    sleepWindow.end !== "00:00" && sleepWindow.start !== sleepWindow.end,
  );
  const [breakStart, setBreakStart] = useState("02:00");
  const [breakEnd, setBreakEnd] = useState("08:00");
  const [editingBreak, setEditingBreak] = useState<{ date: string; start: string; end: string } | null>(null);
  const [applyToAllDays, setApplyToAllDays] = useState(false);

  const breakDurMin = timeToMinutes(breakEnd) - timeToMinutes(breakStart);
  const timelineColors = {
    wake: "bg-zinc-900/85 dark:bg-zinc-100/85",
    bedtime: "bg-zinc-600/85 dark:bg-zinc-300/85",
    break: "bg-zinc-400/80 dark:bg-zinc-500/80",
  } as const;

  const sleepTimeOptions = useMemo(
    () => [
      ...Array.from({ length: 24 * 4 }, (_, i) => {
        const minutes = i * 15;
        const h = String(Math.floor(minutes / 60)).padStart(2, "0");
        const m = String(minutes % 60).padStart(2, "0");
        return `${h}:${m}`;
      }),
      "24:00",
    ],
    [],
  );

  const effectiveHasSleepStart = hasSleepStart;
  const computedStart = effectiveHasSleepStart ? start : "00:00";
  const computedEnd = hasWakeTime ? end : "00:00";
  const noNightBoundary = computedStart === computedEnd;
  const spansMidnight = timeToMinutes(computedEnd) <= timeToMinutes(computedStart);
  const wakeOnlyMode = hasWakeTime && !effectiveHasSleepStart;
  const bedtimeOnlyMode = effectiveHasSleepStart && !hasWakeTime;

  const bedtimeOptions = useMemo(() => {
    const noMidnightStart = sleepTimeOptions.filter((time) => time !== "00:00");
    if (!hasWakeTime) return noMidnightStart;
    const wakeMin = timeToMinutes(end);
    return noMidnightStart.filter((time) => time === "24:00" || timeToMinutes(time) > wakeMin);
  }, [hasWakeTime, end, sleepTimeOptions]);
  const wakeOptions = useMemo(() => {
    if (!effectiveHasSleepStart) return sleepTimeOptions.filter((time) => time !== "24:00");
    const bedtimeCutoff = timeToMinutes(start);
    return sleepTimeOptions.filter((time) => time !== "24:00" && timeToMinutes(time) < bedtimeCutoff);
  }, [effectiveHasSleepStart, start, sleepTimeOptions]);

  const toPct = (min: number) => `${(Math.max(0, Math.min(24 * 60, min)) / (24 * 60)) * 100}%`;
  const wakeMin = hasWakeTime ? timeToMinutes(end) : null;
  const bedtimeMin = effectiveHasSleepStart ? timeToMinutes(start) : null;
  const bedtimeVisualMin = hasSleepStart ? (start === "24:00" ? 24 * 60 : timeToMinutes(start)) : null;
  const sleepSegments = (() => {
    if (!hasSleepStart && !hasWakeTime) return [] as Array<{ start: number; end: number }>;
    if (wakeOnlyMode && wakeMin !== null) return [{ start: 0, end: wakeMin }];
    if (bedtimeOnlyMode && bedtimeMin !== null) return [{ start: bedtimeMin, end: 24 * 60 }];
    if (bedtimeMin === null || wakeMin === null) return [] as Array<{ start: number; end: number }>;
    if (wakeMin <= bedtimeMin) return [{ start: 0, end: wakeMin }, { start: bedtimeMin, end: 24 * 60 }];
    return [{ start: bedtimeMin, end: wakeMin }];
  })();
  const totalSleepMin = (() => {
    const gross = sleepSegments.reduce((sum, segment) => sum + Math.max(0, segment.end - segment.start), 0);
    if (gross === 0 || sleepCuts.length === 0) return gross;
    let overlapMin = 0;
    for (const segment of sleepSegments) {
      for (const cut of sleepCuts) {
        const cutStart = timeToMinutes(cut.start);
        const cutEnd = timeToMinutes(cut.end);
        const overlap = Math.max(0, Math.min(segment.end, cutEnd) - Math.max(segment.start, cutStart));
        overlapMin += overlap;
      }
    }
    return Math.max(0, gross - overlapMin);
  })();
  const breakStartOptions = useMemo(() => {
    const dayOptions = sleepTimeOptions.filter((time) => time !== "24:00");
    const ranges = sleepSegments.length > 0 ? sleepSegments : [{ start: 0, end: 24 * 60 }];
    return dayOptions.filter((time) => {
      const min = timeToMinutes(time);
      return ranges.some((segment) => min >= segment.start && min + SNAP <= segment.end);
    });
  }, [sleepTimeOptions, sleepSegments]);
  const breakEndOptions = useMemo(() => {
    const dayOptions = sleepTimeOptions.filter((time) => time !== "24:00");
    const startMin = timeToMinutes(breakStart);
    const ranges = sleepSegments.length > 0 ? sleepSegments : [{ start: 0, end: 24 * 60 }];
    const activeRange = ranges.find((segment) => startMin >= segment.start && startMin < segment.end);
    if (!activeRange) return dayOptions.filter((time) => timeToMinutes(time) > startMin);
    return dayOptions.filter((time) => {
      const endMin = timeToMinutes(time);
      return endMin > startMin && endMin <= activeRange.end;
    });
  }, [sleepTimeOptions, sleepSegments, breakStart]);
  const canSaveBreak =
    breakDurMin > 0 &&
    breakStartOptions.includes(breakStart) &&
    breakEndOptions.includes(breakEnd);

  function save() {
    if ((hasSleepStart && !start) || (hasWakeTime && !end)) return;
    if (hasWakeTime && !wakeOptions.includes(end)) return;
    if (hasWakeTime && effectiveHasSleepStart && timeToMinutes(start) <= timeToMinutes(end)) return;
    if (!hasSleepStart && !hasWakeTime) {
      onSaveWindow({ start: "00:00", end: "00:00", applyToAllDays });
      onClose();
      return;
    }
    onSaveWindow({ start: computedStart, end: computedEnd, applyToAllDays });
    onClose();
  }

  useEffect(() => {
    if (!hasSleepStart) return;
    if (bedtimeOptions.includes(start)) return;
    setStart(bedtimeOptions[0] ?? "24:00");
  }, [hasSleepStart, bedtimeOptions, start]);

  useEffect(() => {
    if (!hasWakeTime) return;
    if (wakeOptions.includes(end)) return;
    setEnd(wakeOptions[wakeOptions.length - 1] ?? "00:00");
  }, [hasWakeTime, wakeOptions, end]);

  useEffect(() => {
    if (breakStartOptions.includes(breakStart)) return;
    setBreakStart(breakStartOptions[0] ?? "00:00");
  }, [breakStartOptions, breakStart]);

  useEffect(() => {
    if (breakEndOptions.includes(breakEnd)) return;
    setBreakEnd(breakEndOptions[0] ?? breakStart);
  }, [breakEndOptions, breakEnd, breakStart]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">
            {isPt ? "Sono" : "Sleep"}
          </DialogTitle>
          <DialogDescription>
            {isPt
              ? `Configurando ${dayLabel}. Para consistência semanal, aplique este padrão para todos os dias.`
              : `Configuring ${dayLabel}. For weekly consistency, apply this pattern to all days.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="apply-sleep-all-days"
                checked={applyToAllDays}
                onCheckedChange={(checked) => setApplyToAllDays(checked === true)}
              />
              <Label htmlFor="apply-sleep-all-days" className="text-[11px] text-muted-foreground">
                {isPt ? "Aplicar este padrão de sono a todos os dias" : "Apply this sleep pattern to all days"}
              </Label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 min-h-[2.5rem]">
                <Checkbox id="sleep-end-enabled" checked={hasWakeTime} onCheckedChange={(checked) => setHasWakeTime(checked === true)} />
                <Label htmlFor="sleep-end-enabled" className="text-[11px] text-muted-foreground">
                  {isPt ? "Definir horário de acordar" : "Set wake time"}
                </Label>
              </div>
              <div className={hasWakeTime ? "" : "pointer-events-none opacity-50"}>
                <TimeSelect value={end} onValueChange={setEnd} bcp47={bcp47} max={effectiveHasSleepStart ? start : undefined} placeholder={isPt ? "Horario" : "Time"} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 min-h-[2.5rem]">
                <Checkbox id="sleep-start-enabled" checked={hasSleepStart} onCheckedChange={(checked) => setHasSleepStart(checked === true)} />
                <Label htmlFor="sleep-start-enabled" className="text-[11px] text-muted-foreground">
                  {isPt ? "Definir horário para dormir" : "Set bedtime"}
                </Label>
              </div>
              <div className={hasSleepStart ? "" : "pointer-events-none opacity-50"}>
                <TimeSelect value={start} onValueChange={setStart} bcp47={bcp47} min={hasWakeTime ? end : undefined} allowMidnight exclude={["00:00"]} placeholder={isPt ? "Horario" : "Time"} />
              </div>
            </div>
          </div>
          <div className="space-y-2 rounded-md border border-border/50 bg-gradient-to-b from-card/70 to-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isPt ? "Mapa visual de sono" : "Sleep visual map"}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${timelineColors.wake}`} />{isPt ? "Acordar" : "Wake"}</span>
              <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${timelineColors.bedtime}`} />{isPt ? "Dormir" : "Bedtime"}</span>
              <span className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${timelineColors.break}`} />{isPt ? "Pausa" : "Break"}</span>
            </div>
            <div className="relative h-8 rounded-lg border border-border/40 bg-card/80 px-2">
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2">
                <div className="relative h-[6px]">
                  <div className="absolute inset-0 rounded-full bg-border/60" />
                  {sleepSegments.map((segment, index) => (
                    <div
                      key={`sleep-segment-${index}`}
                      className="absolute top-0 h-[6px] rounded-full bg-zinc-700/35 dark:bg-zinc-300/35"
                      style={{ left: toPct(segment.start), width: toPct(segment.end - segment.start) }}
                    />
                  ))}
                  {sleepCuts.map((cut, index) => {
                    const cutStart = timeToMinutes(cut.start);
                    const cutEnd = timeToMinutes(cut.end);
                    return (
                      <div
                        key={`cut-${index}-${cut.start}-${cut.end}`}
                        className={`absolute top-0 h-[6px] rounded-full ${timelineColors.break}`}
                        style={{ left: toPct(cutStart), width: toPct(cutEnd - cutStart) }}
                      />
                    );
                  })}
                  {wakeMin !== null && (
                    <div
                      className={`absolute top-1/2 h-6 w-0.5 -translate-y-1/2 rounded ${timelineColors.wake}`}
                      style={{ left: toPct(Math.min(24 * 60 - 1, wakeMin)) }}
                    />
                  )}
                  {bedtimeVisualMin !== null && (
                    <div
                      className={`absolute top-1/2 h-6 w-0.5 -translate-y-1/2 rounded ${timelineColors.bedtime}`}
                      style={{ left: toPct(Math.min(24 * 60 - 1, bedtimeVisualMin)) }}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isPt ? `Sono total: ${fmtFriendlyDuration(totalSleepMin, true)}` : `Total sleep: ${fmtFriendlyDuration(totalSleepMin, false)}`}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground">
              {!hasSleepStart && !hasWakeTime
                ? (isPt ? "Sem janela de sono ativa para este dia." : "No active sleep window for this day.")
                : wakeOnlyMode
                ? (isPt ? "Modo acordar apenas: a timeline útil começa no horário de acordar." : "Wake-only mode: effective timeline starts at wake time.")
                : bedtimeOnlyMode
                ? (isPt ? "Modo dormir apenas: o dia encerra na faixa final noturna." : "Bedtime-only mode: day closes with a night-end cap.")
                : noNightBoundary
                ? (isPt ? "Início e fim iguais; ajuste para formar uma janela válida." : "Start and end are equal; adjust to create a valid window.")
                : spansMidnight
                ? (isPt ? "Janela noturna atravessa a meia-noite." : "Night window spans across midnight.")
                : (isPt ? "Janela de sono no mesmo dia." : "Sleep window stays within the same day.")}
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-dashed border-border/60 bg-muted/20 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {bcp47.toLowerCase().startsWith("pt") ? "Pausas de sono neste dia" : "Sleep breaks for this day"}
            </div>
            {sleepCuts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{bcp47.toLowerCase().startsWith("pt") ? "Nenhuma pausa cadastrada." : "No sleep breaks yet."}</p>
            ) : (
              <div className="space-y-1.5">
                {sleepCuts.map((cut) => (
                  <div key={`${cut.date}-${cut.start}-${cut.end}`} className="flex items-center justify-between rounded border border-border/50 bg-muted/35 px-2 py-1">
                    <span className="text-[11px] num text-muted-foreground">{formatClock(cut.start, bcp47)}–{formatClock(cut.end, bcp47)}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 border-border/40 bg-muted/40 px-2 text-[10px] hover:bg-muted/60"
                        onClick={() => {
                          setEditingBreak({ date: cut.date, start: cut.start, end: cut.end });
                          setBreakStart(cut.start);
                          setBreakEnd(cut.end);
                        }}
                      >
                        {bcp47.toLowerCase().startsWith("pt") ? "Editar" : "Edit"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 border-border/40 bg-muted/40 px-2 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          onRemoveSleepCut({ date: cut.date, start: cut.start, end: cut.end });
                          if (editingBreak && editingBreak.date === cut.date && editingBreak.start === cut.start && editingBreak.end === cut.end) {
                            setEditingBreak(null);
                          }
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        {bcp47.toLowerCase().startsWith("pt") ? "Remover" : "Remove"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.start}</Label>
                <TimeSelect value={breakStart} onValueChange={setBreakStart} bcp47={bcp47} times={breakStartOptions} placeholder={isPt ? "Horario" : "Time"} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.end}</Label>
                <TimeSelect value={breakEnd} onValueChange={setBreakEnd} bcp47={bcp47} times={breakEndOptions} placeholder={isPt ? "Horario" : "Time"} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className={`text-[11px] ${canSaveBreak ? "text-muted-foreground" : "text-rose-500"}`}>
                {canSaveBreak
                  ? `${bcp47.toLowerCase().startsWith("pt") ? "Duracao" : "Duration"}: ${fmtFriendlyDuration(breakDurMin, bcp47.toLowerCase().startsWith("pt"))}`
                  : (bcp47.toLowerCase().startsWith("pt") ? "O fim deve ser apos o inicio." : "End must be after start.")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  onAddOrUpdateSleepCut({
                    start: breakStart,
                    end: breakEnd,
                    previous: editingBreak ? { date: editingBreak.date, start: editingBreak.start, end: editingBreak.end } : undefined,
                  });
                  setEditingBreak(null);
                }}
                disabled={!canSaveBreak}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {editingBreak
                  ? (bcp47.toLowerCase().startsWith("pt") ? "Atualizar pausa" : "Update break")
                  : (bcp47.toLowerCase().startsWith("pt") ? "Salvar pausa" : "Save break")}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
          <Button size="sm" onClick={save}>{t.common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
