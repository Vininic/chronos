import { useState } from "react";
import { DayPlanner } from "@/components/dashboard/DayPlanner";
import { PerformanceCard, BalanceCard, FocusBlocksCard, AetherisCard, OptimizationStrip, kindStyle, TAILWIND_TO_HEX } from "@/components/dashboard/widgets";
import { useAuth } from "@/lib/auth";
import { buildAgendaForDate, getSleepWindowForDay, useSchedule } from "@/lib/schedule/store";
import { BlockKind, durationMin, timeToMinutes } from "@/lib/schedule/types";
import { useFmtDur, useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { ChevronDown, Plus, Trash2, Brain, Pencil, X, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/ui/time-select";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function fmtFriendlyDuration(totalMin: number, isPt: boolean) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return isPt ? `${h}h ${m}min` : `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return isPt ? `${m}min` : `${m}m`;
}

export default function Today() {
  const { session } = useAuth();
  const { data, addCommitment, removeCommitment, updateCategory, resetCategoryNaming } = useSchedule();
  const { bcp47 } = useI18n();
  const t = useT();
  const scheduleText = useScheduleText();
  const firstName = session?.name?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.chronos.today.greetingMorning : hour < 18 ? t.chronos.today.greetingAfternoon : t.chronos.today.greetingEvening;
  const dateStr = new Date().toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "long" });
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const todayAgenda = buildAgendaForDate(data, new Date()).sort((a, b) => a.start.localeCompare(b.start));
  const timelineAgenda = todayAgenda.filter((a) => !(a.kind === "sleep" && (a.continuesFromPrevDay || a.continuesToNextDay)));
  const currentBlock = timelineAgenda.find((a) => timeToMinutes(a.start) <= nowMin && nowMin < timeToMinutes(a.end));
  const nextTimelineBlock = timelineAgenda.find((a) => timeToMinutes(a.start) > nowMin);
  const enforceSleepBoundary = data.meta.enforceSleepBoundary !== false;
  const sleepSchedule = data.meta.sleepSchedule ?? [data.meta.sleepWindow ?? { start: "22:30", end: "07:00" }];
  const sleepEntry = getSleepWindowForDay(sleepSchedule, new Date().getDay()) ?? sleepSchedule[0];
  const sleepStartMin = timeToMinutes(sleepEntry.start);
  const sleepEndMin = timeToMinutes(sleepEntry.end);
  const sleepSpansNextDay = sleepEndMin <= sleepStartMin;
  const nextSleepWindow = enforceSleepBoundary && sleepSpansNextDay && nowMin < sleepStartMin
    ? { id: "next-sleep-window", source: "routine" as const, kind: "sleep" as const, title: "sleep", titleCustom: undefined, start: sleepEntry.start, end: sleepEntry.end, synthetic: true }
    : null;
  const nextBlock = nextTimelineBlock ?? nextSleepWindow;
  const nextLabel = bcp47.toLowerCase().startsWith("pt") ? "Próximo" : "Next";
  const isPt = bcp47.toLowerCase().startsWith("pt");
  const emptyNowLabel = isPt ? "Sem bloco atual" : "No current block";
  const emptyNextLabel = isPt ? "Sem próximo bloco" : "No next block";

  const routineById = new Map(data.routine.map((r) => [r.id, r]));
  const commitmentById = new Map(data.commitments.map((c) => [c.id, c]));

  function resolveDisplayBlock<T extends { id: string; source: "routine" | "commitment"; sourceId?: string; start: string; end: string; title: string; titleCustom?: string; kind: keyof typeof kindStyle }>(block: T | null) {
    if (!block) return null;
    const sourceId = block.sourceId ?? block.id;
    if (block.source === "routine") { const src = routineById.get(sourceId); if (src) return { ...block, start: src.start, end: src.end }; }
    if (block.source === "commitment") { const src = commitmentById.get(sourceId); if (src) return { ...block, start: src.start, end: src.end }; }
    return block;
  }

  const displayCurrentBlock = resolveDisplayBlock(currentBlock ?? null);
  const displayNextBlock = nextBlock && !("synthetic" in nextBlock) ? resolveDisplayBlock(nextBlock) : nextBlock;

  function jumpToBlock(id: string, source: "routine" | "commitment") {
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
      />

      <DayPlanner />

      <CommitmentCard
        data={data}
        addCommitment={addCommitment}
        removeCommitment={removeCommitment}
        t={t}
        bcp47={bcp47}
        isPt={isPt}
        scheduleText={scheduleText}
      />

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5"><FocusBlocksCard /></div>
        <div className="lg:col-span-7"><BalanceCard /></div>
      </div>

      <PerformanceStatsSection />

      <div className="mt-6">
        <AetherisCard compact />
      </div>

      <CategorySection
        data={data}
        updateCategory={updateCategory}
        resetCategoryNaming={resetCategoryNaming}
        t={t}
        scheduleText={scheduleText}
      />
    </>
  );
}

function NowNextCards({
  t, displayCurrentBlock, displayNextBlock, currentBlock, nextBlock, jumpToBlock,
  nextLabel, emptyNowLabel, emptyNextLabel, fmtFriendlyDuration, isPt, scheduleText, bcp47,
}: any) {
  return (
    <section className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-fade-up">
      <div className={`rounded-lg border px-4 py-3 ${displayCurrentBlock ? `${kindStyle[displayCurrentBlock.kind].blockBorder} ${kindStyle[displayCurrentBlock.kind].blockBg}` : "border-dashed border-border/60 bg-muted/5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t.chronos.today.now}</div>
            <div className="mt-1 text-sm font-medium text-primary truncate">{currentBlock ? scheduleText.blockTitle(currentBlock.title, currentBlock.titleCustom) : emptyNowLabel}</div>
            <div className="mt-1 text-xs num text-muted-foreground">{displayCurrentBlock ? `${displayCurrentBlock.start}–${displayCurrentBlock.end} · ${fmtFriendlyDuration(durationMin(displayCurrentBlock.start, displayCurrentBlock.end), isPt)}` : "--:--"}</div>
          </div>
          <button type="button" onClick={() => currentBlock && jumpToBlock(currentBlock.id, currentBlock.source)} disabled={!currentBlock} className="h-7 w-7 rounded-md border border-border/60 grid place-items-center text-muted-foreground enabled:hover:text-primary enabled:hover:border-secondary/50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>
      <div className={`rounded-lg border px-4 py-3 ${displayNextBlock ? `${kindStyle[displayNextBlock.kind].blockBorder} ${kindStyle[displayNextBlock.kind].blockBg}` : "border-dashed border-border/60 bg-muted/5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{nextLabel}</div>
            <div className="mt-1 text-sm font-medium text-primary truncate">{displayNextBlock ? (displayNextBlock.kind === "sleep" ? (isPt ? "Sono" : "Sleep") : scheduleText.blockTitle(displayNextBlock.title, displayNextBlock.titleCustom)) : emptyNextLabel}</div>
            <div className="mt-1 text-xs num text-muted-foreground">{displayNextBlock ? `${displayNextBlock.start}–${displayNextBlock.end} · ${fmtFriendlyDuration(durationMin(displayNextBlock.start, displayNextBlock.end), isPt)}` : "--:--"}</div>
          </div>
          <button type="button" onClick={() => nextBlock && !("synthetic" in nextBlock) && jumpToBlock(nextBlock.id, nextBlock.source)} disabled={!nextBlock || ("synthetic" in nextBlock)} className="h-7 w-7 rounded-md border border-border/60 grid place-items-center text-muted-foreground enabled:hover:text-primary enabled:hover:border-secondary/50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  );
}

function CommitmentCard({ data, addCommitment, removeCommitment, t, bcp47, isPt, scheduleText }: any) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [kind, setKind] = useState<BlockKind>("meeting");
  const [title, setTitle] = useState("");
  const fmtDur = useFmtDur();

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast({ title: t.chronos.atlas.needsTitle });
    if (start >= end) return toast({ title: t.chronos.atlas.endAfterStart });
    const error = addCommitment({ date, start, end, kind, title: title.trim() });
    if (error) return toast({ title: "Scheduling conflict", description: error });
    toast({ title: t.chronos.atlas.added }); setTitle("");
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayCommitments = data.commitments.filter((c: any) => c.date === todayIso).sort((a: any, b: any) => a.start.localeCompare(b.start));
  const upcomingCommitments = data.commitments.filter((c: any) => c.date > todayIso).sort((a: any, b: any) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.atlas.eyebrow}</div>
        <span className="text-xs text-muted-foreground num">· {t.chronos.atlas.countLabel(data.commitments.length)}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={add} className="chronos-card p-5 space-y-3 lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.atlas.addEyebrow}</div>
          <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.atlas.titleField}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.chronos.atlas.titlePlaceholder} className="h-8" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.atlas.date}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" /></div>
            <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.atlas.category}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{data.categories.map((c: any) => (<SelectItem key={c.id} value={c.id}>{scheduleText.categoryLabel(c.id, c.label, c.labelCustom)}</SelectItem>))}</SelectContent>
              </Select></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.atlas.start}</Label><TimeSelect value={start} onValueChange={setStart} bcp47={bcp47} /></div>
            <div className="space-y-1"><Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.atlas.end}</Label><TimeSelect value={end} onValueChange={setEnd} bcp47={bcp47} /></div>
          </div>
          <Button type="submit" className="w-full h-8 text-xs"><Plus className="h-3.5 w-3.5 mr-1" /> {t.chronos.atlas.addCommitment}</Button>
        </form>
        <div className="chronos-card p-5 lg:col-span-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.atlas.inTheBook}</div>
          {data.commitments.length === 0 ? (
            <div className="mt-6 rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">{t.chronos.atlas.empty}</div>
          ) : (
            <div className="mt-4 space-y-4">
              {todayCommitments.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-primary mb-2 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                    {t.chronos.today.eyebrow}
                  </div>
                  <ul className="space-y-1.5">
                    {todayCommitments.map((c: any) => {
                      const s = kindStyle[c.kind as BlockKind];
                      return (
                        <li key={c.id} className="flex items-center gap-2.5 rounded-md border border-border/60 bg-surface-raised px-3.5 py-2.5 text-sm group hover:border-secondary/30 transition-colors">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s?.dot ?? "bg-secondary"}`} />
                          <span className="flex-1 truncate text-primary font-medium">{scheduleText.blockTitle(c.title, c.titleCustom)}</span>
                          <span className="text-xs num text-muted-foreground">{c.start}–{c.end} · {fmtDur(durationMin(c.start, c.end))}</span>
                          <button onClick={() => { removeCommitment(c.id); toast({ title: t.chronos.atlas.removed }); }} className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {upcomingCommitments.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-primary mb-2 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                    {isPt ? "Próximos" : "Upcoming"}
                  </div>
                  <ul className="space-y-1.5">
                    {upcomingCommitments.map((c: any) => {
                      const s = kindStyle[c.kind as BlockKind];
                      return (
                        <li key={c.id} className="flex items-center gap-2.5 rounded-md border border-border/60 bg-surface-raised px-3.5 py-2.5 text-sm group hover:border-secondary/30 transition-colors">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${s?.dot ?? "bg-secondary"}`} />
                          <span className="flex-1 truncate text-primary font-medium">{scheduleText.blockTitle(c.title, c.titleCustom)}</span>
                          <span className="text-xs num text-muted-foreground">{c.date.slice(5)} · {c.start} · {fmtDur(durationMin(c.start, c.end))}</span>
                          <button onClick={() => { removeCommitment(c.id); toast({ title: t.chronos.atlas.removed }); }} className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PerformanceStatsSection() {
  return (
    <section className="mt-10">
      <PerformanceCard />
      <div className="mt-6"><OptimizationStrip /></div>
    </section>
  );
}

function CategorySection({ data, updateCategory, resetCategoryNaming, t, scheduleText }: any) {
  const [open, setOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState(() =>
    data.categories.reduce((acc: any, c: any) => {
      acc[c.id] = { customLabel: c.labelCustom ?? "", customDescription: c.descriptionCustom ?? "", tone: c.tone };
      return acc;
    }, {} as Record<string, { customLabel: string; customDescription: string; tone: string }>)
  );

  if (!open) {
    return (
      <section className="mt-10">
        <button onClick={() => setOpen(true)} className="chronos-card p-6 w-full text-left flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.settings.categories}</div>
            <h3 className="font-display text-xl text-primary mt-0.5">{t.chronos.settings.vocabulary}</h3>
          </div>
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </button>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <div className="chronos-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.settings.categories}</div>
            <h3 className="font-display text-xl text-primary mt-0.5">{t.chronos.settings.vocabulary}</h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}><X className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="space-y-3">
          {data.categories.map((c: any) => {
            const draft = draftCategories[c.id] ?? { customLabel: c.labelCustom ?? "", customDescription: c.descriptionCustom ?? "", tone: c.tone };
            const defaultLabel = scheduleText.categoryLabel(c.id, c.label);
            const defaultDescription = scheduleText.categoryDescription(c.id, c.description);
            return (
              <div key={c.id} className="rounded-md border border-border/60 bg-surface-raised p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${kindStyle[c.id as BlockKind]?.dot ?? "bg-secondary"}`} />
                    <div className="text-sm text-primary font-medium">{scheduleText.categoryLabel(c.id, c.label, c.labelCustom)}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{c.id}</span>
                </div>
                <div className="rounded-md border border-border/50 bg-background/60 p-2.5 space-y-1.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.defaultCategoryName}</Label>
                    <div className="text-sm text-primary">{defaultLabel}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.defaultCategoryDescription}</Label>
                    <div className="text-xs text-muted-foreground">{defaultDescription}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.customCategoryName}</Label>
                    <Input value={draft.customLabel} onChange={(e) => setDraftCategories((prev: any) => ({ ...prev, [c.id]: { ...draft, customLabel: e.target.value } }))} placeholder={defaultLabel} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.customCategoryDescription}</Label>
                    <Input value={draft.customDescription} onChange={(e) => setDraftCategories((prev: any) => ({ ...prev, [c.id]: { ...draft, customDescription: e.target.value } }))} placeholder={defaultDescription} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.settings.categoryTone}</Label>
                    <Select value={draft.tone} onValueChange={(v) => setDraftCategories((prev: any) => ({ ...prev, [c.id]: { ...draft, tone: v } }))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["bronze", "midnight", "primary-glow", "emerald", "neutral", "indigo", "amber"].map((tone) => (<SelectItem key={tone} value={tone}>{tone}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-between gap-2">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => { resetCategoryNaming(c.id); setDraftCategories((prev: any) => ({ ...prev, [c.id]: { ...draft, customLabel: "", customDescription: "" } })); toast({ title: t.chronos.settings.categoryRestored }); }}>
                    {t.chronos.settings.restoreDefaultNames}
                  </Button>
                  <Button size="sm" className="h-8" onClick={() => { updateCategory(c.id, { labelCustom: draft.customLabel.trim() || undefined, descriptionCustom: draft.customDescription.trim() || undefined, tone: draft.tone }); toast({ title: t.chronos.settings.categoryUpdated }); }}>
                    {t.common.save}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
