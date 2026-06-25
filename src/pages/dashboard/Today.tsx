import { useEffect, useMemo, useRef, useState } from "react";
import { DayPlanner, type DayPlannerHandle } from "@/components/dashboard/DayPlanner";
import { ComposeBlockDialog } from "@/components/dashboard/ComposeBlockDialog";
import { FocusBlocksCard, AetherisCard, safeKindStyle, alpha, TAILWIND_TO_HEX } from "@/components/dashboard/widgets";
import { GoalSection } from "@/components/dashboard/GoalSection";
import { useAuth } from "@/lib/auth";
import { useSchedule } from "@/lib/schedule/store";
import { buildAgendaForDate } from "@/lib/schedule/agenda";
import { getSleepWindowForDay } from "@/lib/schedule/sleep";
import type { AgendaItem } from "@/lib/schedule/agenda";
import { BlockKind, durationMin, snapTime, timeToMinutes, eisenhowerQuadrant, quadrantOrder, QUADRANT_COLORS, QUADRANT_TEXT_COLORS, QUADRANT_LABELS, fmtDur, BUILTIN_KINDS, computeGoalProgress, getPeriodStartEnd, DAY_LABELS, categoryRoleOf } from "@/lib/schedule/types";
import type { Goal, ScheduleData, Preset, Commitment } from "@/lib/schedule/types";
import type { GoalFields } from "@/components/dashboard/GoalDialog";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { Label } from "@/components/ui/label";
import { ChevronDown, Plus, Trash2, Eye, Pencil, Check, X, RotateCcw, AlertTriangle, Target, LayoutGrid, Dumbbell, BookOpen, GraduationCap, ClipboardList, Brain, ListChecks, Box, Activity, Zap, Heart } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { setDragCommitmentInfo } from "@/lib/dragStore";
import { formatClock, fmtFriendlyDuration } from "@/lib/schedule/planner-format";
import { parseNoteLine, parseNotes, noteToneStyles } from "@/lib/schedule/planner-notes";
import type { NoteLine, NoteTone } from "@/lib/schedule/planner-notes";
import { BlockTypeGallery } from "@/components/dashboard/BlockTypeGallery";
import { NowNextCards } from "@/components/dashboard/NowNextCards";
import { DayProgressCard, FocusRecoveryCard, AgendaStatsCard } from "@/components/dashboard/StatsCards";

export default function Today() {
  const { session } = useAuth();
  const { data, addRoutine, addCommitment, removeCommitment, updateCommitment, updateCategory, resetCategoryNaming, addCategory, removeCategory, reorderCategory, setFocusCategories, removePreset, addGoal, updateGoal, removeGoal, addGoalBlock, removeGoalBlock, updateGoalBlock, toggleGoalBlock, addGoalSubTask, toggleGoalSubTask, getGoalsForDate, generateGoalCommitments } = useSchedule();
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

  function resolveDisplayBlock<T extends { id: string; source: "routine" | "commitment"; sourceId?: string; start: string; end: string; title: string; titleCustom?: string; kind: string; continuesToNextDay?: boolean; continuesFromPrevDay?: boolean }>(block: T | null) {
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
    const preset = data.presets.find((p) => p.id === commitmentId);
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
            onAddBlock={(goalId, duration) => addGoalBlock(goalId, { goalId, title: "", duration: duration ?? 60, date: todayIso, done: true, order: 0 })}
            onAssignMode={setAssignGoalId}
            compact
          />
        </div>
      )}

      <div className="mt-10 border-t border-border/30 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.focus}</div>
          <span className="text-xs text-muted-foreground">· {t.chronos.widgets.focusToday}</span>
        </div>
        <FocusBlocksCard />
      </div>

      {/* Daily stats section */}
      <div className="mt-10 border-t border-border/30 pt-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.today.eyebrow}</div>
          <span className="text-xs text-muted-foreground">· {isPt ? "Estatísticas do dia" : "Daily stats"}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DayProgressCard agenda={todayAgenda} categories={data.categories} t={t} isPt={isPt} />
          <FocusRecoveryCard agenda={todayAgenda} categories={data.categories} t={t} isPt={isPt} />
          <AgendaStatsCard agenda={todayAgenda} categories={data.categories} t={t} isPt={isPt} />
        </div>
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
        <div className="flex items-center gap-2 mb-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.settings.categories}</div>
          <span className="text-xs text-muted-foreground">· {t.chronos.settings.vocabulary}</span>
        </div>
        <BlockTypeGallery
          data={data}
          t={t}
          isPt={isPt}
          scheduleText={scheduleText}
          onUpdate={updateCategory}
          onReset={resetCategoryNaming}
          onAdd={addCategory}
          onRemove={removeCategory}
          onReorder={reorderCategory}
          onSetFocus={setFocusCategories}
        />
      </div>

    </>
  );
}

function CommitmentDetailDialog({ c, open, onClose, onRemove, onUpdate }: { c: ScheduleData["commitments"][number]; open: boolean; onClose: () => void; onRemove: (id: string) => void; onUpdate: (id: string, patch: Partial<ScheduleData["commitments"][number]>) => void }) {
  const t = useT();
  const { bcp47 } = useI18n();
  const isPt = bcp47.toLowerCase().startsWith("pt");
  const scheduleText = useScheduleText();
  const { data: cdData } = useSchedule();
  const s = safeKindStyle(c.kind, cdData.categories);
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
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.dot}`} style={s.dotStyle} />
            <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${s.chip} ${s.blockBorder}`} style={s.chipStyle}>{scheduleText.categoryLabel(c.kind, cdData.categories.find((cat) => cat.id === c.kind)?.label, cdData.categories.find((cat) => cat.id === c.kind)?.labelCustom)}</span>
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

function CommitmentListPopup({ sections, initialSection, open, onClose }: { sections: { key: string; label: string; items: (ScheduleData["commitments"][number] | ScheduleData["presets"][number])[] }[]; initialSection: string; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState(initialSection);
  const { bcp47 } = useI18n();
  const isPt = bcp47.toLowerCase().startsWith("pt");
  const scheduleText = useScheduleText();
  const { data: clpData } = useSchedule();
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
          {active.items.map((c, idx: number) => {
            const s = safeKindStyle(c.kind, clpData.categories);
            return (
              <div key={c.id}>
                {showDivider && idx === MAX_VISIBLE && <div className="border-t border-dashed border-border/40 my-2" />}
                <div className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm ${
                  isPresetSection
                    ? "border-dashed border-amber-500/30 bg-amber-500/5"
                    : "border-border/60 bg-surface-raised"
                }`}>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} style={s.dotStyle} />
                  <span className="flex-1 truncate text-primary font-medium min-w-0">{scheduleText.blockTitle(c.title, c.titleCustom)}</span>
                  <span className="text-[11px] num text-muted-foreground/60 shrink-0 whitespace-nowrap">
                    {isPresetSection ? fmtDur((c as Preset).duration) : (
                      active.key === "loose"
                        ? `${fmtFriendlyDuration(durationMin((c as Commitment).start, (c as Commitment).end), isPt)}`
                        : `${(c as Commitment).date!.slice(5)} · ${formatClock((c as Commitment).start, bcp47)}`
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

function CommitmentCard({ data, addCommitment, removeCommitment, updateCommitment, removePreset, t, bcp47, isPt, scheduleText }: {
  data: ScheduleData;
  addCommitment: (c: Parameters<ReturnType<typeof useSchedule>["addCommitment"]>[0]) => ReturnType<ReturnType<typeof useSchedule>["addCommitment"]>;
  removeCommitment: (id: string) => void;
  updateCommitment: (id: string, patch: Parameters<ReturnType<typeof useSchedule>["updateCommitment"]>[1]) => ReturnType<ReturnType<typeof useSchedule>["updateCommitment"]>;
  removePreset: (id: string) => void;
  t: ReturnType<typeof useT>;
  bcp47: string;
  isPt: boolean;
  scheduleText: ReturnType<typeof useScheduleText>;
}) {
  const [detailCommitment, setDetailCommitment] = useState<ScheduleData["commitments"][number] | null>(null);
  const [listPopupSection, setListPopupSection] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, commitmentId: string) {
    const c = data.commitments.find((x) => x.id === commitmentId);
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
  function clearAll(items: ScheduleData["commitments"]) {
    items.forEach((c) => removeCommitment(c.id));
    toast({ title: isPt ? "Compromissos removidos" : "Commitments removed" });
  }

  function sortByPriority(a: ScheduleData["commitments"][number], b: ScheduleData["commitments"][number]) {
    const qa = quadrantOrder(eisenhowerQuadrant(a.priority));
    const qb = quadrantOrder(eisenhowerQuadrant(b.priority));
    if (qa !== qb) return qa - qb;
    return a.start.localeCompare(b.start);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const undated = data.commitments.filter((c) => !c.date).sort(sortByPriority);
  const todayCommits = data.commitments.filter((c) => c.date === todayIso).sort(sortByPriority);
  const upcomingCommits = data.commitments.filter((c) => c.date && c.date > todayIso).sort((a, b) => a.date.localeCompare(b.date) || sortByPriority(a, b));
  const pastCommits = data.commitments.filter((c) => c.date && c.date < todayIso).sort((a, b) => b.date.localeCompare(a.date) || sortByPriority(a, b));
  const presets = data.presets ?? [];

  const sections: { key: string; label: string; items: ScheduleData["commitments"] }[] = [
    { key: "loose", label: isPt ? "Compromissos soltos" : "Loose commitments", items: undated },
    { key: "today", label: t.chronos.today.eyebrow, items: todayCommits },
    { key: "upcoming", label: isPt ? "Próximos" : "Upcoming", items: upcomingCommits },
    { key: "past", label: isPt ? "Anteriores" : "Past", items: pastCommits },
  ];
  const popupSections = presets.length > 0
    ? [{ key: "presets", label: isPt ? "Modelos" : "Presets", items: presets }, ...sections]
    : sections;



  function card(c: ScheduleData["commitments"][number]) {
    const s = safeKindStyle(c.kind, data.categories);
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
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm ${s.dot}`} style={s.dotStyle} />
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.dot}`} style={s.dotStyle} />
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

  function presetCard(p: ScheduleData["presets"][number]) {
    const pStyle = safeKindStyle(p.kind, data.categories);
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
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${pStyle.dot}`} style={pStyle.dotStyle} />
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
        <span className={`rounded border px-1.5 py-[1px] text-[9px] uppercase tracking-wider ${pStyle.chip} ${pStyle.blockBorder}`} style={pStyle.chipStyle}>
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
            <div className="space-y-1.5">{presets.map((p) => presetCard(p))}</div>
          </div>
        )}

        {data.commitments.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">{t.chronos.atlas.empty}</div>
        ) : (
          <div className="mt-4 space-y-3">
            {sections.map((sec) => {
              if (sec.items.length === 0) return null;
              let visible: ScheduleData["commitments"];
              let hiddenCount = 0;
              if (sec.items.length > MAX_VISIBLE) {
                const doFirst = sec.items.filter((i) => quadrantOrder(eisenhowerQuadrant(i.priority)) === 0);
                const others = sec.items.filter((i) => quadrantOrder(eisenhowerQuadrant(i.priority)) !== 0);
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
                    {visible.map((c) => card(c))}
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


/* ─── Daily stats cards ─── */







