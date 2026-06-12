import { useEffect, useMemo, useRef, useState } from "react";
import { DayPlanner, type DayPlannerHandle } from "@/components/dashboard/DayPlanner";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { PerformanceCard, BalanceCard, FocusBlocksCard, AetherisCard, OptimizationStrip, kindStyle, safeKindStyle, TAILWIND_TO_HEX, COLOR_PALETTE, COLOR_FAMILIES } from "@/components/dashboard/widgets";
import { GoalSection } from "@/components/dashboard/GoalSection";
import { useAuth } from "@/lib/auth";
import { buildAgendaForDate, getSleepWindowForDay, useSchedule } from "@/lib/schedule/store";
import { BlockKind, durationMin, snapTime, timeToMinutes, eisenhowerQuadrant, quadrantOrder, QUADRANT_COLORS, QUADRANT_TEXT_COLORS, QUADRANT_LABELS, fmtDur, BUILTIN_KINDS, computeGoalProgress, getPeriodStartEnd, DAY_LABELS } from "@/lib/schedule/types";
import type { Goal } from "@/lib/schedule/types";
import type { GoalFields } from "@/components/dashboard/GoalDialog";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { Label } from "@/components/ui/label";
import { ChevronDown, Plus, Trash2, Eye, Pencil, Check, X, RotateCcw, AlertTriangle, Target, LayoutGrid, PencilRuler } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { setDragCommitmentInfo } from "@/lib/dragStore";
import { WORKSPACE_PRESETS } from "@/workspaces/presets";
import { TemplateEditor } from "@/components/dashboard/TemplateEditor";


function formatClock(time: string, bcp47: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(bcp47, { hour: "numeric", minute: "2-digit" });
}

function fmtFriendlyDuration(totalMin: number, isPt: boolean) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return isPt ? `${h}h ${m}min` : `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return isPt ? `${m}min` : `${m}m`;
}

export default function Today() {
  const { session } = useAuth();
  const { data, addRoutine, addCommitment, removeCommitment, updateCommitment, updateCategory, resetCategoryNaming, addCategory, removeCategory, removePreset, addGoal, updateGoal, removeGoal, addGoalBlock, removeGoalBlock, updateGoalBlock, toggleGoalBlock, addGoalSubTask, toggleGoalSubTask, getGoalsForDate, generateGoalCommitments } = useSchedule();
  const { bcp47 } = useI18n();
  const t = useT();
  const scheduleText = useScheduleText();
  const firstName = session?.name?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.chronos.today.greetingMorning : hour < 18 ? t.chronos.today.greetingAfternoon : t.chronos.today.greetingEvening;
  const dateStr = new Date().toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "long" });
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const todayDate = new Date();
  const dayPlannerRef = useRef<DayPlannerHandle>(null);
  const [assignGoalId, setAssignGoalId] = useState<string | null>(null);
  const todayAgenda = buildAgendaForDate(data, todayDate).sort((a, b) => a.start.localeCompare(b.start));
  const currentBlock = todayAgenda.find((a) => timeToMinutes(a.start) <= nowMin && nowMin < timeToMinutes(a.end)) ?? null;
  const nextNonSleep = todayAgenda.find((a) => a.kind !== "sleep" && timeToMinutes(a.start) > nowMin) ?? null;
  const tomorrow = new Date(todayDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowAgenda = buildAgendaForDate(data, tomorrow);
  const firstTomorrowNonSleep = tomorrowAgenda.find((a) => a.kind !== "sleep") ?? null;
  const nextBlock = nextNonSleep
    ?? todayAgenda.find((a) => timeToMinutes(a.start) > nowMin)
    ?? (currentBlock?.kind !== "sleep" ? todayAgenda.find((a) => a.start === "00:00") : null)
    ?? firstTomorrowNonSleep
    ?? null;
  const isPt = bcp47.toLowerCase().startsWith("pt");
  const isNextFromTomorrow = !nextNonSleep && firstTomorrowNonSleep !== null && nextBlock === firstTomorrowNonSleep;
  const nextLabel = isPt ? "Próximo" : "Next";
  const emptyNowLabel = isPt ? "Sem bloco atual" : "No current block";
  const emptyNextLabel = isPt ? "Sem próximo bloco" : "No next block";

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayGoals = getGoalsForDate(todayIso);

  const sleepSchedule = data.meta.sleepSchedule ?? [data.meta.sleepWindow ?? { start: "22:30", end: "07:00" }];
  const sleepEntry = getSleepWindowForDay(sleepSchedule, todayDate.getDay()) ?? sleepSchedule[0];

  const routineById = new Map(data.routine.map((r) => [r.id, r]));
  const commitmentById = new Map(data.commitments.map((c) => [c.id, c]));

  function resolveDisplayBlock<T extends { id: string; source: "routine" | "commitment"; sourceId?: string; start: string; end: string; title: string; titleCustom?: string; kind: keyof typeof kindStyle }>(block: T | null) {
    if (!block) return null;
    if (block.kind === "sleep") {
      // PM segment (bedtime): sleep ends tomorrow morning — use next day's entry for wake time
      if (block.continuesToNextDay) {
        const tomorrow = (todayDate.getDay() + 1) % 7;
        const tmwEntry = getSleepWindowForDay(sleepSchedule, tomorrow);
        const end = tmwEntry?.end ?? block.end;
        return { ...block, start: block.start, end };
      }
      // AM segment (wake-up): sleep started last night — use previous day's entry for bedtime
      if (block.continuesFromPrevDay) {
        const yesterday = (todayDate.getDay() + 6) % 7;
        const ystEntry = getSleepWindowForDay(sleepSchedule, yesterday);
        const start = ystEntry?.start ?? block.start;
        return { ...block, start, end: block.end };
      }
      return block;
    }
    const sourceId = block.sourceId ?? block.id;
    if (block.source === "routine") { const src = routineById.get(sourceId); if (src) return { ...block, start: src.start, end: src.end }; }
    if (block.source === "commitment") { const src = commitmentById.get(sourceId); if (src) return { ...block, start: src.start, end: src.end }; }
    return block;
  }

  const displayCurrentBlock = resolveDisplayBlock(currentBlock ?? null);
  const displayNextBlock = resolveDisplayBlock(nextBlock ?? null);

  function handleCommitmentDrop(commitmentId: string, date: string, start: string) {
    const c = data.commitments.find((x) => x.id === commitmentId);
    if (c) {
      const dur = durationMin(c.start, c.end);
      const startMin = timeToMinutes(start);
      const end = snapTime(startMin + dur);
      const err = updateCommitment(commitmentId, { date, start, end });
      if (err) toast({ title: isPt ? "Conflito de agenda" : "Scheduling conflict", description: err });
      else toast({ title: t.chronos.atlas.added });
      return;
    }
    // Preset drop — create new commitment
    const preset = data.presets.find((p: any) => p.id === commitmentId);
    if (!preset) return;
    const startMin = timeToMinutes(start);
    const end = snapTime(startMin + preset.duration);
    const id = addCommitment({ title: preset.title, titleCustom: preset.titleCustom, kind: preset.kind, start, end, date, notes: preset.notes, priority: preset.priority, workspace: preset.workspace });
    if (id) toast({ title: isPt ? "Compromisso adicionado" : "Commitment added" });
  }

  function jumpToBlock(id: string, source: "routine" | "commitment", kind?: string) {
    if (kind === "sleep") {
      const block = currentBlock?.kind === "sleep" ? currentBlock : nextBlock;
      if (block) {
        const startMin = timeToMinutes(block.start);
        dayPlannerRef.current?.scrollToMinute(startMin, block.continuesToNextDay ? "end" : "start");
      }
      return;
    }
    const target = document.getElementById(`day-block-${source}-${id}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <>
      <header className="mb-5 animate-fade-up">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.today.eyebrow}</div>
        <h1 className="font-display text-3xl text-primary mt-1">
          {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">{dateStr}</p>
      </header>

      <NowNextCards
        t={t}
        displayCurrentBlock={displayCurrentBlock}
        displayNextBlock={displayNextBlock}
        currentBlock={currentBlock}
        nextBlock={nextBlock}
        jumpToBlock={jumpToBlock}
        nextLabel={nextLabel}
        emptyNowLabel={emptyNowLabel}
        emptyNextLabel={emptyNextLabel}
        fmtFriendlyDuration={fmtFriendlyDuration}
        isPt={isPt}
        scheduleText={scheduleText}
        bcp47={bcp47}
        isNextFromTomorrow={isNextFromTomorrow}
      />

      <div id="today-dayplanner" className="mt-10 border-t border-border/30 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.today.eyebrow}</div>
          <span className="text-xs text-muted-foreground">· {t.chronos.widgets.dailyAgenda}</span>
        </div>
        <DayPlanner ref={dayPlannerRef} onCommitmentDrop={handleCommitmentDrop} assignGoalId={assignGoalId} onAssignMode={setAssignGoalId} />
      </div>

      <div className="mt-10 border-t border-border/30 pt-5">
        <CommitmentCard
          data={data}
          addCommitment={addCommitment}
          removeCommitment={removeCommitment}
          updateCommitment={updateCommitment}
          removePreset={removePreset}
          t={t}
          bcp47={bcp47}
          isPt={isPt}
          scheduleText={scheduleText}
        />
      </div>

      {todayGoals.length > 0 && (
        <div className="mt-10 border-t border-border/30 pt-5">
          <GoalSection
            goals={todayGoals}
            allGoals={data.goals}
            commitments={data.commitments}
            routine={data.routine}
            snapshots={data.progressSnapshots}
            categories={data.categories}
            onAddGoal={(fields: GoalFields) => {
              const id = addGoal({ ...fields, kind: fields.kind, tracking: fields.tracking });
              if (fields.autoTrackMode === "commitments") generateGoalCommitments(id);
            }}
            onUpdateGoal={updateGoal}
            onRemoveGoal={removeGoal}
            onToggleBlock={toggleGoalBlock}
            onToggleSubTask={toggleGoalSubTask}
            onAddSubTask={addGoalSubTask}
            onAddBlock={(goalId, duration) => addGoalBlock(goalId, { title: "", duration: duration ?? 60, date: todayIso, done: true, order: 0 })}
            onAssignMode={setAssignGoalId}
            compact
          />
        </div>
      )}

      <div className="mt-10 border-t border-border/30 pt-5">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.focus}</div>
            <span className="text-xs text-muted-foreground">· {t.chronos.widgets.balanceTitle}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5"><FocusBlocksCard /></div>
            <div className="lg:col-span-7"><BalanceCard /></div>
          </div>
        </section>
      </div>

      <div className="mt-10 border-t border-border/30 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.perfIndex}</div>
          <span className="text-xs text-muted-foreground">· {t.chronos.widgets.compositionScore}</span>
        </div>
        <PerformanceStatsSection goals={data.goals} todayIso={todayIso} t={t} data={data} />
      </div>

      <div className="mt-10 border-t border-border/30 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.nav.aetheris}</div>
          <span className="text-xs text-muted-foreground">· {t.chronos.aetheris.quietSuggestions}</span>
        </div>
        <section>
          <AetherisCard compact />
        </section>
      </div>

      <div className="mt-10 border-t border-border/30 pt-5">
        <BlockTypeGallery
          data={data}
          t={t}
          isPt={isPt}
          scheduleText={scheduleText}
          onUpdate={updateCategory}
          onReset={resetCategoryNaming}
          onAdd={addCategory}
          onRemove={removeCategory}
          addRoutine={addRoutine}
          addCommitment={addCommitment}
          todayIso={todayIso}
        />
      </div>

    </>
  );
}

function NowNextCards({
  t, displayCurrentBlock, displayNextBlock, currentBlock, nextBlock, jumpToBlock,
  nextLabel, emptyNowLabel, emptyNextLabel, fmtFriendlyDuration, isPt, scheduleText, bcp47, isNextFromTomorrow,
}: any) {
  function cardStyle(kind: string) {
    if (kind === "sleep") return "border-primary/35 bg-muted/45";
    const s = kindStyle[kind as keyof typeof kindStyle];
    return s ? `${s.blockBorder} ${s.blockBg}` : "border-dashed border-border/60 bg-muted/5";
  }

  return (
    <section className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-fade-up">
      <div className={`rounded-lg border px-4 py-3 ${displayCurrentBlock ? cardStyle(displayCurrentBlock.kind) : "border-dashed border-border/60 bg-muted/5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t.chronos.today.now}</div>
            <div className="mt-1 text-sm font-medium text-primary truncate">{currentBlock ? (currentBlock.kind === "sleep" ? scheduleText.categoryLabel("sleep", currentBlock.title, currentBlock.titleCustom) : scheduleText.blockTitle(currentBlock.title, currentBlock.titleCustom)) : emptyNowLabel}</div>
            <div className="mt-1 text-xs num text-muted-foreground">{displayCurrentBlock ? `${formatClock(displayCurrentBlock.start, bcp47)}–${formatClock(displayCurrentBlock.end, bcp47)} · ${fmtFriendlyDuration(durationMin(displayCurrentBlock.start, displayCurrentBlock.end), isPt)}` : "--:--"}</div>
          </div>
          <button type="button" onClick={() => currentBlock && jumpToBlock(currentBlock.id, currentBlock.source, currentBlock.kind)} disabled={!currentBlock} className="h-7 w-7 rounded-md border border-border/60 grid place-items-center text-muted-foreground enabled:hover:text-primary enabled:hover:border-secondary/50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>
      <div className={`rounded-lg border px-4 py-3 ${displayNextBlock ? cardStyle(displayNextBlock.kind) : "border-dashed border-border/60 bg-muted/5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{nextLabel}</div>
            <div className="mt-1 text-sm font-medium text-primary truncate">{displayNextBlock ? (displayNextBlock.kind === "sleep" ? scheduleText.categoryLabel("sleep", displayNextBlock.title, displayNextBlock.titleCustom) : scheduleText.blockTitle(displayNextBlock.title, displayNextBlock.titleCustom)) : emptyNextLabel}</div>
            <div className="mt-1 text-xs num text-muted-foreground">{displayNextBlock ? `${formatClock(displayNextBlock.start, bcp47)}–${formatClock(displayNextBlock.end, bcp47)} · ${fmtFriendlyDuration(durationMin(displayNextBlock.start, displayNextBlock.end), isPt)}` : "--:--"}</div>
          </div>
          <button type="button" onClick={() => nextBlock && !isNextFromTomorrow && jumpToBlock(nextBlock.id, nextBlock.source, nextBlock.kind)} disabled={!nextBlock || isNextFromTomorrow} className="h-7 w-7 rounded-md border border-border/60 grid place-items-center text-muted-foreground enabled:hover:text-primary enabled:hover:border-secondary/50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  );
}

type NoteTone = "amber" | "sky" | "emerald" | "rose" | "violet";
type NoteLine = { text: string; tone: NoteTone };
const noteToneStyles: Record<NoteTone, { bg: string; border: string; text: string; chip: string; solid: string }> = {
  amber: { bg: "bg-amber-500/12", border: "border-amber-500/25", text: "text-amber-900 dark:text-amber-100", chip: "bg-amber-500/20 text-amber-700 dark:text-amber-200", solid: "bg-amber-500" },
  sky: { bg: "bg-sky-500/12", border: "border-sky-500/25", text: "text-sky-900 dark:text-sky-100", chip: "bg-sky-500/20 text-sky-700 dark:text-sky-200", solid: "bg-sky-500" },
  emerald: { bg: "bg-emerald-500/12", border: "border-emerald-500/25", text: "text-emerald-900 dark:text-emerald-100", chip: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200", solid: "bg-emerald-500" },
  rose: { bg: "bg-rose-500/12", border: "border-rose-500/25", text: "text-rose-900 dark:text-rose-100", chip: "bg-rose-500/20 text-rose-700 dark:text-rose-200", solid: "bg-rose-500" },
  violet: { bg: "bg-violet-500/12", border: "border-violet-500/25", text: "text-violet-900 dark:text-violet-100", chip: "bg-violet-500/20 text-violet-700 dark:text-violet-200", solid: "bg-violet-500" },
};

function parseNoteLine(raw: string): NoteLine {
  const trimmed = raw.trim();
  const explicit = trimmed.match(/^(amber|yellow|sky|blue|emerald|green|rose|red|violet|purple)\s*:\s*(.+)$/i);
  if (explicit) {
    const token = explicit[1].toLowerCase();
    const text = explicit[2].trim();
    const tone: NoteTone =
      token === "yellow" ? "amber"
      : token === "blue" ? "sky"
      : token === "green" ? "emerald"
      : token === "red" ? "rose"
      : token === "purple" ? "violet"
      : (token as NoteTone);
    return { text, tone };
  }
  return { text: trimmed, tone: "amber" };
}

function parseNotes(notes?: string): NoteLine[] {
  return (notes ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => parseNoteLine(l));
}

function CommitmentDetailDialog({ c, open, onClose, onRemove, onUpdate }: { c: any; open: boolean; onClose: () => void; onRemove: (id: string) => void; onUpdate: (id: string, patch: any) => void }) {
  const t = useT();
  const { bcp47 } = useI18n();
  const isPt = bcp47.toLowerCase().startsWith("pt");
  const scheduleText = useScheduleText();
  const s = kindStyle[c.kind as BlockKind];
  const noteLines = parseNotes(c.notes);
  const dur = durationMin(c.start, c.end);
  const [urgent, setUrgent] = useState(c.priority?.urgent ?? false);
  const [important, setImportant] = useState(c.priority?.important ?? false);

  function toggleUrgent() {
    const next = !urgent;
    setUrgent(next);
    onUpdate(c.id, { priority: { urgent: next, important } });
  }
  function toggleImportant() {
    const next = !important;
    setImportant(next);
    onUpdate(c.id, { priority: { urgent, important: next } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">{scheduleText.blockTitle(c.title, c.titleCustom)}</DialogTitle>
          <DialogDescription>
            {isPt ? "Detalhes do compromisso." : "Commitment details."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex items-center gap-2.5">
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s?.dot ?? "bg-secondary"}`} />
            <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${s?.chip ?? ""} ${s?.blockBorder ?? ""}`}>{t.common.kinds[c.kind]}</span>
          </div>
          <div className="text-sm num text-muted-foreground">
            {c.date ? `${c.date} · ${formatClock(c.start, bcp47)}–${formatClock(c.end, bcp47)} · ${fmtFriendlyDuration(dur, isPt)}` : fmtFriendlyDuration(dur, isPt)}
            {!c.date && <span className="ml-2 text-amber-500/70 text-[10px] uppercase tracking-wider">{isPt ? "(solto)" : "(loose)"}</span>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{isPt ? "Prioridade" : "Priority"}</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleUrgent}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  urgent
                    ? "border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400"
                    : "text-muted-foreground/70 hover:bg-red-500/5 hover:text-red-500/70"
                }`}
              >
                {isPt ? "Urgente" : "Urgent"}
              </button>
              <button
                type="button"
                onClick={toggleImportant}
                className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  important
                    ? "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "text-muted-foreground/70 hover:bg-blue-500/5 hover:text-blue-500/70"
                }`}
              >
                {isPt ? "Importante" : "Important"}
              </button>
            </div>
          </div>
          {noteLines.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{t.chronos.atlas.notes}</div>
              <div className="space-y-1.5">
                {noteLines.map((line, idx) => {
                  const nt = noteToneStyles[line.tone];
                  return (
                    <div key={`detail-note-${idx}`} className={`rounded border px-2 py-1 text-sm ${nt.border} ${nt.bg} ${nt.text}`}>
                      {line.text}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
          <Button variant="ghost" size="sm" onClick={() => { onRemove(c.id); onClose(); }} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />{t.chronos.today.removeBlock}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommitmentListPopup({ sections, initialSection, open, onClose }: { sections: { key: string; label: string; items: any[] }[]; initialSection: string; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState(initialSection);
  const { bcp47 } = useI18n();
  const isPt = bcp47.toLowerCase().startsWith("pt");
  const scheduleText = useScheduleText();
  useEffect(() => { if (open) setTab(initialSection); }, [open, initialSection]);
  const active = sections.find((s) => s.key === tab);
  if (!active) return null;
  const isPresetSection = active.key === "presets";
  const showDivider = !isPresetSection && active.items.length > MAX_VISIBLE;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">{isPt ? "Todos os compromissos" : "All commitments"}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-1.5 border-b border-border/40 pb-2 mb-3 overflow-x-auto">
          {sections.filter((s) => s.items.length > 0).map((sec) => (
            <button
              key={sec.key}
              onClick={() => setTab(sec.key)}
              className={`shrink-0 rounded px-2 py-1 text-[10px] uppercase tracking-wider transition-colors ${
                sec.key === "presets"
                  ? tab === sec.key ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground/60 hover:text-amber-500/70"
                  : tab === sec.key ? "bg-secondary/15 text-secondary font-medium" : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              {sec.label} <span className="num ml-0.5 opacity-70">{sec.items.length}</span>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {active.items.map((c: any, idx: number) => {
            const s = kindStyle[c.kind as BlockKind];
            return (
              <div key={c.id}>
                {showDivider && idx === MAX_VISIBLE && <div className="border-t border-dashed border-border/40 my-2" />}
                <div className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm ${
                  isPresetSection
                    ? "border-dashed border-amber-500/30 bg-amber-500/5"
                    : "border-border/60 bg-surface-raised"
                }`}>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${s?.dot ?? "bg-secondary"}`} />
                  <span className="flex-1 truncate text-primary font-medium min-w-0">{scheduleText.blockTitle(c.title, c.titleCustom)}</span>
                  <span className="text-[11px] num text-muted-foreground/60 shrink-0 whitespace-nowrap">
                    {isPresetSection ? fmtDur(c.duration) : (
                      active.key === "loose"
                        ? `${fmtFriendlyDuration(durationMin(c.start, c.end), isPt)}`
                        : `${c.date.slice(5)} · ${formatClock(c.start, bcp47)}`
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const MAX_VISIBLE = 4;

function CommitmentCard({ data, addCommitment, removeCommitment, updateCommitment, removePreset, t, bcp47, isPt, scheduleText }: any) {
  const [detailCommitment, setDetailCommitment] = useState<any>(null);
  const [listPopupSection, setListPopupSection] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, commitmentId: string) {
    const c = data.commitments.find((x: any) => x.id === commitmentId);
    if (!c) return;
    const dur = durationMin(c.start, c.end);
    e.dataTransfer.setData("application/x-chronos-commitment", JSON.stringify({ commitmentId, dur }));
    e.dataTransfer.effectAllowed = "copy";
    setDragCommitmentInfo({ id: commitmentId, dur });
  }
  function handleDragEnd() {
    setDragCommitmentInfo(null);
  }

  function remove(id: string) {
    removeCommitment(id);
    toast({ title: t.chronos.atlas.removed });
  }
  function clearAll(items: any[]) {
    items.forEach((c: any) => removeCommitment(c.id));
    toast({ title: isPt ? "Compromissos removidos" : "Commitments removed" });
  }

  function sortByPriority(a: any, b: any) {
    const qa = quadrantOrder(eisenhowerQuadrant(a.priority));
    const qb = quadrantOrder(eisenhowerQuadrant(b.priority));
    if (qa !== qb) return qa - qb;
    return a.start.localeCompare(b.start);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const undated = data.commitments.filter((c: any) => !c.date).sort(sortByPriority);
  const todayCommits = data.commitments.filter((c: any) => c.date === todayIso).sort(sortByPriority);
  const upcomingCommits = data.commitments.filter((c: any) => c.date && c.date > todayIso).sort((a: any, b: any) => a.date.localeCompare(b.date) || sortByPriority(a, b));
  const pastCommits = data.commitments.filter((c: any) => c.date && c.date < todayIso).sort((a: any, b: any) => b.date.localeCompare(a.date) || sortByPriority(a, b));
  const presets = data.presets ?? [];

  const sections: { key: string; label: string; items: any[] }[] = [
    { key: "loose", label: isPt ? "Compromissos soltos" : "Loose commitments", items: undated },
    { key: "today", label: t.chronos.today.eyebrow, items: todayCommits },
    { key: "upcoming", label: isPt ? "Próximos" : "Upcoming", items: upcomingCommits },
    { key: "past", label: isPt ? "Anteriores" : "Past", items: pastCommits },
  ];
  const popupSections = presets.length > 0
    ? [{ key: "presets", label: isPt ? "Modelos" : "Presets", items: presets }, ...sections]
    : sections;



  function card(c: any) {
    const s = kindStyle[c.kind as BlockKind];
    const dur = durationMin(c.start, c.end);
    const isUndated = !c.date;
    const timeStr = isUndated
      ? `${fmtFriendlyDuration(dur, isPt)}`
      : `${c.date.slice(5)} · ${formatClock(c.start, bcp47)} · ${fmtFriendlyDuration(dur, isPt)}`;
    const noteLines = parseNotes(c.notes);
    return (
      <div
        key={c.id}
        className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-raised px-3 py-2 text-sm hover:border-secondary/30 transition-colors relative overflow-hidden group cursor-pointer"
        draggable={isUndated}
        onDragStart={(e) => handleDragStart(e, c.id)}
        onDragEnd={handleDragEnd}
        onClick={() => setDetailCommitment(c)}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm ${s?.dot ?? "bg-secondary"}`} />
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s?.dot ?? "bg-secondary"}`} />
        <span className="shrink-0 flex items-center gap-0.5 min-w-[4.5rem] prio-group">
          <span className={`h-2 w-2 rounded-full ${c.priority ? QUADRANT_COLORS[eisenhowerQuadrant(c.priority)] : "invisible"}`} />
          <span className={`text-[9px] whitespace-nowrap transition-opacity ${c.priority ? QUADRANT_TEXT_COLORS[eisenhowerQuadrant(c.priority)] + " opacity-0 prio-label" : "invisible"}`}>
            {c.priority ? QUADRANT_LABELS[eisenhowerQuadrant(c.priority)][isPt ? "pt" : "en"] : "placeholder"}
          </span>
        </span>
        <span className="flex-1 truncate text-primary font-medium min-w-0">{scheduleText.blockTitle(c.title, c.titleCustom)}</span>
        {noteLines.length > 0 && (
          <div className="flex items-center gap-0.5 shrink-0 min-w-0 max-w-[160px] overflow-hidden" title={c.notes}>
            {noteLines.slice(0, 1).map((line, idx) => {
              const nt = noteToneStyles[line.tone];
              return (
                <span key={`${line.text}-${idx}`} className={`rounded px-1.5 py-[1px] text-[9px] ${nt.bg} ${nt.text} truncate max-w-[130px]`}>
                  {line.text}
                </span>
              );
            })}
            {noteLines.length > 1 && <span className="text-[9px] text-muted-foreground/40 shrink-0">+{noteLines.length - 1}</span>}
          </div>
        )}
        <span className="text-[11px] num text-muted-foreground/60 shrink-0 whitespace-nowrap">{timeStr}</span>
        {isUndated && (
          <span className="shrink-0 text-[9px] uppercase tracking-wider text-amber-500/60 font-medium">
            {isPt ? "LIVRE" : "LOOSE"}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); remove(c.id); }}
          className="text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-0.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  function presetCard(p: any) {
    return (
      <div
        key={p.id}
        className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm hover:border-amber-500/50 transition-colors group cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => {
          const dur = p.duration;
          e.dataTransfer.setData("application/x-chronos-commitment", JSON.stringify({ commitmentId: "__preset__", dur }));
          e.dataTransfer.effectAllowed = "copy";
          setDragCommitmentInfo({ id: p.id, dur });
        }}
        onDragEnd={handleDragEnd}
      >
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${kindStyle[p.kind as BlockKind]?.dot ?? "bg-secondary"}`} />
        <span className="shrink-0 flex items-center gap-0.5 min-w-[4.5rem] prio-group">
          {p.priority && (
            <>
              <span className={`h-2 w-2 rounded-full ${QUADRANT_COLORS[eisenhowerQuadrant(p.priority)]}`} />
              <span className={`text-[9px] whitespace-nowrap opacity-0 prio-label transition-opacity ${QUADRANT_TEXT_COLORS[eisenhowerQuadrant(p.priority)]}`}>
                {QUADRANT_LABELS[eisenhowerQuadrant(p.priority)][isPt ? "pt" : "en"]}
              </span>
            </>
          )}
        </span>
        <span className="flex-1 truncate text-primary font-medium min-w-0">{scheduleText.blockTitle(p.title, p.titleCustom)}</span>
        <span className="text-[11px] num text-muted-foreground/60 shrink-0">{fmtDur(p.duration)}</span>
        <span className={`rounded border px-1.5 py-[1px] text-[9px] uppercase tracking-wider ${kindStyle[p.kind as BlockKind]?.chip ?? ""} ${kindStyle[p.kind as BlockKind]?.blockBorder ?? ""}`}>
          {t.common.kinds[p.kind]}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const id = addCommitment({ title: p.title, titleCustom: p.titleCustom, kind: p.kind, start: "09:00", end: snapTime(timeToMinutes("09:00") + p.duration), notes: p.notes, priority: p.priority });
            if (id) toast({ title: isPt ? "Compromisso criado" : "Commitment created" });
          }}
          className="shrink-0 text-muted-foreground/30 hover:text-secondary transition-colors"
          title={isPt ? "Criar compromisso solto" : "Create loose commitment"}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); removePreset(p.id); }}
          className="shrink-0 text-muted-foreground/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <section>
      <style>{`.prio-group:hover .prio-label { opacity: 1 !important; }`}</style>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.atlas.eyebrow}</div>
          <span className="text-xs text-muted-foreground num">· {t.chronos.atlas.countLabel(data.commitments.length)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground/60 hover:text-secondary" onClick={() => setListPopupSection(popupSections.find(s => s.items.length > 0)?.key ?? "today")}>
            <Eye className="h-3 w-3 mr-1" />{isPt ? "Tudo" : "All"}
          </Button>
          <ComposeBlockDialog
            defaultMode="commitment"
            trigger={
              <Button size="sm" className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" /> {t.chronos.atlas.addCommitment}
              </Button>
            }
          />
        </div>
      </div>
      <div className="chronos-card p-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.atlas.inTheBook}</div>

        {presets.length > 0 && (
          <div className="mt-4 mb-5 pb-4 border-b border-border/30">
            <div className="text-[10px] uppercase tracking-[0.22em] text-secondary mb-2.5 flex items-center gap-2">
              <span>{isPt ? "Modelos" : "Presets"}</span>
              <span className="text-xs text-muted-foreground/50 num">{presets.length}</span>
            </div>
            <div className="space-y-1.5">{presets.map((p: any) => presetCard(p))}</div>
          </div>
        )}

        {data.commitments.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">{t.chronos.atlas.empty}</div>
        ) : (
          <div className="mt-4 space-y-3">
            {sections.map((sec) => {
              if (sec.items.length === 0) return null;
              let visible: any[];
              let hiddenCount = 0;
              if (sec.items.length > MAX_VISIBLE) {
                const doFirst = sec.items.filter((i: any) => quadrantOrder(eisenhowerQuadrant(i.priority)) === 0);
                const others = sec.items.filter((i: any) => quadrantOrder(eisenhowerQuadrant(i.priority)) !== 0);
                if (doFirst.length >= MAX_VISIBLE) {
                  visible = doFirst;
                  hiddenCount = others.length;
                } else {
                  const slots = MAX_VISIBLE - doFirst.length;
                  visible = [...doFirst, ...others.slice(0, slots)];
                  hiddenCount = sec.items.length - visible.length;
                }
              } else {
                visible = sec.items;
              }
              return (
                <div key={sec.key} className={`group ${sec.key === "past" ? "opacity-70" : ""}`}>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-secondary mb-2.5 flex items-center gap-2">
                    <span>{sec.label}</span>
                    <span className="text-xs text-muted-foreground/50 num">{sec.items.length}</span>
                    {sec.items.length > 0 && (
                      <button
                        onClick={() => clearAll(sec.items)}
                        className="ml-auto text-[9px] text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                      >
                        {isPt ? "Limpar" : "Clear"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {visible.map((c: any) => card(c))}
                    {hiddenCount > 0 && (
                      <button
                        onClick={() => setListPopupSection(sec.key)}
                        className="w-full flex items-center gap-2 rounded-lg border border-dashed border-border/40 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground/50 hover:text-secondary hover:border-secondary/30 transition-colors text-left"
                      >
                        <span>+{hiddenCount} {isPt ? "mais" : "more"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {detailCommitment && (
        <CommitmentDetailDialog
          c={detailCommitment}
          open={!!detailCommitment}
          onClose={() => setDetailCommitment(null)}
          onRemove={remove}
          onUpdate={updateCommitment}
        />
      )}
      {listPopupSection && (
        <CommitmentListPopup
          sections={popupSections}
          initialSection={listPopupSection}
          open={!!listPopupSection}
          onClose={() => setListPopupSection(null)}
        />
      )}
    </section>
  );
}

function PerformanceStatsSection({ goals, todayIso, t, data }: { goals: Goal[]; todayIso: string; t: any; data: any }) {
  const activeGoals = goals.filter((g) => {
    const pp = getPeriodStartEnd(g.startDate, g.period, todayIso);
    return todayIso >= pp.start && todayIso <= pp.end;
  });
  const p = activeGoals.reduce((acc, g) => {
    const gp = computeGoalProgress(g, todayIso, goals, data.routine, data.commitments);
    acc.weighted += gp.ratio * g.weight;
    acc.totalWeight += g.weight;
    if (gp.denominator > 0 && gp.ratio >= 1) acc.done++;
    return acc;
  }, { weighted: 0, totalWeight: 0, done: 0 });
  const overall = p.totalWeight > 0 ? p.weighted / p.totalWeight : 0;

  return (
    <section className="space-y-6">
      {activeGoals.length > 0 && (
        <div className="chronos-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-secondary" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.goals.eyebrow}</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(overall * 100)}%`, backgroundColor: "hsl(var(--secondary))" }} />
            </div>
            <span className="text-xs text-primary font-medium num">{Math.round(overall * 100)}%</span>
          </div>
          <div className="text-[10px] text-muted-foreground mb-3">
            {p.done}/{activeGoals.length} goals completed
          </div>
          <div className="space-y-1.5">
            {activeGoals.map((g) => {
              const gp = computeGoalProgress(g, todayIso, goals, data.routine, data.commitments);
              return (
                <div key={g.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-primary truncate flex-1">{g.title}</span>
                  <div className="w-20 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(gp.ratio * 100)}%`, backgroundColor: g.color ?? "hsl(var(--secondary))" }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground num w-7 text-right">{Math.round(gp.ratio * 100)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <PerformanceCard />
      <div className="mt-6"><OptimizationStrip /></div>
    </section>
  );
}

function BlockTypeGallery({ data, t, isPt, scheduleText, onUpdate, onReset, onAdd, onRemove, addRoutine: _addRoutine, addCommitment: _addCommitment, todayIso: _todayIso }: any) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [configExtCategoryId, setConfigExtCategoryId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createLabel, setCreateLabel] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createColor, setCreateColor] = useState(COLOR_PALETTE[0]);
  const [createWSType, setCreateWSType] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  function startEdit(c: any) {
    setEditingId(c.id);
    setDraftLabel(scheduleText.categoryLabel(c.id, c.label, c.labelCustom));
    setDraftDesc(scheduleText.categoryDescription(c.id, c.description, c.descriptionCustom));
    setDraftColor(c.color ?? TAILWIND_TO_HEX[kindStyle[c.id]?.dot] ?? "#f59e0b");
  }

  function saveEdit(c: any) {
    const labelCustom = draftLabel !== scheduleText.categoryLabel(c.id, c.label, undefined) ? draftLabel : undefined;
    const descriptionCustom = draftDesc !== scheduleText.categoryDescription(c.id, c.description, undefined) ? draftDesc : undefined;
    onUpdate(c.id, {
      labelCustom,
      descriptionCustom,
      color: draftColor,
    });
    setEditingId(null);
    toast({ title: t.chronos.settings.categoryUpdated });
  }

  function cancelEdit() { setEditingId(null); }

  function handleCreate() {
    const id = createLabel.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!id) { toast({ title: "Invalid name" }); return; }
    if (data.categories.find((c: any) => c.id === id)) { toast({ title: "Category already exists" }); return; }
    const preset = createWSType ? WORKSPACE_PRESETS.find((p) => p.id === createWSType) : null;
    const workspace = preset ? preset.create() : undefined;
    onAdd({ id, label: createLabel, description: createDesc, tone: "custom", color: createColor, workspace });
    setShowCreate(false);
    setCreateLabel("");
    setCreateDesc("");
    setCreateColor(COLOR_PALETTE[0]);
    setCreateWSType(null);
    toast({ title: t.chronos.settings.categorySaved(id) });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const kind = deleteTarget;
    const blockCount = data.routine.filter((r: any) => r.kind === kind).length + data.commitments.filter((c: any) => c.kind === kind).length;
    onRemove(kind);
    setDeleteTarget(null);
    toast({ title: `"${kind}" removed` + (blockCount > 0 ? ` · ${blockCount} blocks deleted` : "") });
  }

  function renderColorPicker(color: string, onChange: (c: string) => void) {
    const isCustomColor = color && !COLOR_FAMILIES.some((f) => f.shades.includes(color));
    return (
      <div className="rounded-lg border border-border/60 bg-card p-2 space-y-1.5">
        <div className="grid grid-cols-5 gap-0.5">
          {COLOR_FAMILIES.map((fam) => (
            fam.shades.map((s) => (
              <button key={s} type="button" onClick={() => onChange(color === s ? "" : s)}
                className={`h-5 w-full rounded-[2px] border transition-all ${color === s ? "ring-2 ring-offset-1 ring-secondary" : "border-border/40"}`}
                style={{ backgroundColor: s }}
                title={fam.family}
              />
            ))
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">Custom:</span>
          <input type="color" value={color || "#f59e0b"} onChange={(e) => onChange(e.target.value)}
            className="h-5 w-8 rounded border border-border/60 cursor-pointer p-0.5" />
          {isCustomColor && (
            <span className="text-[9px] font-mono text-muted-foreground">{color}</span>
          )}
          {color && (
            <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-primary ml-auto">
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="chronos-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.settings.categories}</div>
          <span className="text-xs text-muted-foreground">· {t.chronos.settings.vocabulary}</span>
        </div>

        <div className="space-y-px">
          {data.categories.map((c: any) => {
            const blockStyle = safeKindStyle(c.id);
            const dotKey = blockStyle.dot;
            const dotHex = c.color ?? TAILWIND_TO_HEX[dotKey] ?? "#f59e0b";
            const isEditing = editingId === c.id;
            const label = scheduleText.categoryLabel(c.id, c.label, c.labelCustom);
            const description = scheduleText.categoryDescription(c.id, c.description, c.descriptionCustom);
            const isBuiltin = BUILTIN_KINDS.includes(c.id);
            const hasCustom = !!(c.labelCustom || c.descriptionCustom || c.color);
            const customBorder = c.color && !kindStyle[c.id] ? `${c.color}66` : undefined;

            return (
              <div
                key={c.id}
                className={`${blockStyle.blockBg} ${blockStyle.blockBorder} rounded-lg px-4 py-3`}
                style={customBorder ? { borderColor: customBorder } : undefined}
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: dotHex }} />
                      <input
                        autoFocus
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(c); if (e.key === "Escape") cancelEdit(); }}
                        className="flex-1 bg-card/80 text-sm font-medium text-primary rounded px-2 py-1 outline-none border border-border"
                      />
                    </div>
                    <textarea
                      value={draftDesc}
                      onChange={(e) => setDraftDesc(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                      rows={2}
                      className="w-full bg-card/80 text-xs text-muted-foreground rounded px-2 py-1.5 outline-none border border-border resize-none"
                    />
                    <div>{renderColorPicker(draftColor, setDraftColor)}</div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => saveEdit(c)} className="h-7 px-3 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1">
                          <Check className="h-3 w-3" /> {t.common.save}
                        </button>
                        <button onClick={cancelEdit} className="h-7 px-3 rounded text-xs font-medium text-muted-foreground hover:bg-muted/60 transition-colors flex items-center gap-1">
                          <X className="h-3 w-3" /> {t.common.cancel}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasCustom && isBuiltin && (
                          <button onClick={() => { onReset(c.id); setEditingId(null); toast({ title: t.chronos.settings.categoryRestored }); }} className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/60 flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" /> {t.chronos.settings.restoreDefaultNames}
                          </button>
                        )}
                        <button onClick={() => { setDeleteTarget(c.id); cancelEdit(); }} className="text-[10px] text-rose-500/50 hover:text-rose-500/80 flex items-center gap-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: dotHex }} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-primary truncate">{label}</div>
                          {description && <div className="text-xs text-muted-foreground truncate">{description}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wide">{c.id}</div>
                        <button
                          onClick={() => setConfigExtCategoryId(c.id)}
                          className={`flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium leading-none transition-colors hover:bg-muted/40 ${
                            c.workspace ? "text-secondary" : "text-muted-foreground/40 hover:text-secondary/70"
                          }`}
                          title={c.workspace ? (isPt ? "Gerenciar sessões" : "Manage sessions") : (isPt ? "Adicionar sessões" : "Add sessions")}
                        >
                          <LayoutGrid className={`h-3.5 w-3.5 ${c.workspace ? "drop-shadow-[0_0_3px_rgba(168,85,247,0.4)]" : ""}`} />
                        </button>
                        <button
                          onClick={() => startEdit(c)}
                          className="text-[10px] text-muted-foreground/50 hover:text-secondary/80 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/40"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          <button
            onClick={() => setShowCreate(true)}
            className="w-full border-2 border-dashed border-border/40 rounded-lg py-5 flex items-center justify-center gap-2 text-sm text-muted-foreground/50 hover:text-muted-foreground hover:border-muted-foreground/30 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t.common.add}
          </button>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.chronos.settings.category}</DialogTitle>
            <DialogDescription>{isPt ? "Criar novo tipo de bloco" : "Create a new block type"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.categoryName}</Label>
              <input
                autoFocus
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
                placeholder={isPt ? "Ex: Leitura" : "e.g. Reading"}
                className="w-full bg-muted/60 text-sm text-primary rounded px-3 py-2 mt-1 outline-none border border-border"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.categoryDescription}</Label>
              <input
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder={isPt ? "Descrição opcional" : "Optional description"}
                className="w-full bg-muted/60 text-sm text-primary rounded px-3 py-2 mt-1 outline-none border border-border"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isPt ? "Que tipo de sessões?" : "What kind of sessions?"}</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {WORKSPACE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCreateWSType(createWSType === p.id ? null : p.id)}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                      createWSType === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-muted-foreground/30 hover:bg-muted/20"
                    }`}
                  >
                    <span className="text-base leading-none shrink-0 mt-0.5">{p.icon}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-primary">{p.label}</div>
                      <div className="text-[10px] text-muted-foreground/60 leading-snug line-clamp-2">{p.description}</div>
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCreateWSType(null)}
                  className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                    createWSType === null
                      ? "border-primary bg-primary/5"
                      : "border-dashed border-border/50 hover:border-muted-foreground/30 hover:bg-muted/20"
                  }`}
                >
                  <span className="text-base leading-none shrink-0 mt-0.5">🚫</span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-primary">{isPt ? "Nenhum" : "None"}</div>
                    <div className="text-[10px] text-muted-foreground/60 leading-snug">{isPt ? "Sem sessões" : "No sessions"}</div>
                  </div>
                </button>
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.categoryTone}</Label>
              <div className="mt-2">{renderColorPicker(createColor, setCreateColor)}</div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: createColor }} />
                <span className="font-mono">{createColor}</span>
              </div>
              <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>{t.common.cancel}</Button>
              <Button size="sm" onClick={handleCreate}>{t.common.save}</Button>
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-500" /> {isPt ? "Remover categoria" : "Remove category"}</DialogTitle>
            <DialogDescription>
              {deleteTarget && (() => {
                const blockCount = data.routine.filter((r: any) => r.kind === deleteTarget).length + data.commitments.filter((c: any) => c.kind === deleteTarget).length;
                return isPt
                  ? `Isso removerá "${deleteTarget}" e ${blockCount} bloco(s) que usam esta categoria. Esta ação não pode ser desfeita.`
                  : `This will remove "${deleteTarget}" and ${blockCount} block(s) using this category. This action cannot be undone.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)}>{t.common.cancel}</Button>
            <Button size="sm" variant="destructive" onClick={confirmDelete}>{isPt ? "Remover" : "Remove"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {configExtCategoryId && (() => {
        const cat = data.categories.find((c: any) => c.id === configExtCategoryId);
        if (!cat) return null;
        return (
          <Dialog open onOpenChange={(o) => { if (!o) setConfigExtCategoryId(null); }}>
            <DialogContent className="max-w-lg w-[calc(100vw-2rem)] max-h-[min(80vh,calc(100dvh-3rem))] overflow-x-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  {cat.label ?? cat.id}
                </DialogTitle>
              </DialogHeader>
              {cat.workspace ? (
                <div className="space-y-4 py-2">
                  <TemplateEditor
                    structure={cat.workspace}
                    onChange={(ws) => { onUpdate(cat.id, { workspace: ws }); }}
                  />
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <Button variant="destructive" size="sm" onClick={() => { onUpdate(cat.id, { workspace: undefined }); setConfigExtCategoryId(null); }}>
                      {isPt ? "Remover" : "Remove"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    {isPt ? "Escolha um tipo de sessão:" : "Choose a session type:"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {WORKSPACE_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { onUpdate(cat.id, { workspace: p.create() }); }}
                        className="flex items-start gap-2.5 rounded-lg border border-border/50 p-2.5 text-left hover:border-secondary/40 hover:bg-muted/20 transition-colors"
                      >
                        <span className="text-base leading-none shrink-0 mt-0.5">{p.icon}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-primary">{p.label}</div>
                          <div className="text-[10px] text-muted-foreground/60 leading-snug line-clamp-2">{p.description}</div>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={() => { onUpdate(cat.id, { workspace: { levels: [{ key: "item", label: "Item", labelPlural: "Items", fields: [], tracking: { type: "boolean", default: false, label: "Done" } }], display: { summary: "", nextStep: "", progress: "boolean" }, templates: [{ name: "Default", children: [] }] } }); }}
                      className="flex items-center justify-center gap-2.5 rounded-lg border border-dashed border-border/50 p-2.5 hover:border-secondary/40 hover:bg-muted/20 transition-colors col-span-2"
                    >
                      <span className="text-base leading-none shrink-0 mt-0.5">🛠️</span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-primary">{isPt ? "Personalizado" : "Custom"}</div>
                        <div className="text-[10px] text-muted-foreground/60 leading-snug">{isPt ? "Crie seu próprio" : "Create your own"}</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}
    </section>
  );
}





