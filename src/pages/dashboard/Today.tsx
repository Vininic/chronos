import { DayPlanner } from "@/components/dashboard/DayPlanner";
import { BalanceCard, FocusBlocksCard, AetherisCard } from "@/components/dashboard/widgets";
import { useAuth } from "@/lib/auth";
import { buildAgendaForDate, getSleepWindowForDay, useSchedule } from "@/lib/schedule/store";
import { durationMin, timeToMinutes } from "@/lib/schedule/types";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { kindStyle } from "@/components/dashboard/widgets";
import { ChevronDown } from "lucide-react";

function fmtFriendlyDuration(totalMin: number, isPt: boolean) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return isPt ? `${h}h ${m}min` : `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return isPt ? `${m}min` : `${m}m`;
}

export default function Today() {
  const { session } = useAuth();
  const { data } = useSchedule();
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
    ? {
        id: "next-sleep-window",
        source: "routine" as const,
        kind: "sleep" as const,
        title: "sleep",
        titleCustom: undefined,
        start: sleepEntry.start,
        end: sleepEntry.end,
        synthetic: true,
      }
    : null;
  const nextBlock = nextTimelineBlock ?? nextSleepWindow;
  const nextBlockSpansNextDay = nextBlock ? timeToMinutes(nextBlock.end) <= timeToMinutes(nextBlock.start) : false;
  const nextLabel = bcp47.toLowerCase().startsWith("pt") ? "Próximo" : "Next";
  const isPt = bcp47.toLowerCase().startsWith("pt");
  const emptyNowLabel = bcp47.toLowerCase().startsWith("pt") ? "Sem bloco atual" : "No current block";
  const emptyNextLabel = bcp47.toLowerCase().startsWith("pt") ? "Sem próximo bloco" : "No next block";

  const routineById = new Map(data.routine.map((r) => [r.id, r]));
  const commitmentById = new Map(data.commitments.map((c) => [c.id, c]));

  function resolveDisplayBlock<T extends { id: string; source: "routine" | "commitment"; sourceId?: string; start: string; end: string; title: string; titleCustom?: string; kind: keyof typeof kindStyle }>(block: T | null) {
    if (!block) return null;
    const sourceId = block.sourceId ?? block.id;
    if (block.source === "routine") {
      const src = routineById.get(sourceId);
      if (src) return { ...block, start: src.start, end: src.end };
    }
    if (block.source === "commitment") {
      const src = commitmentById.get(sourceId);
      if (src) return { ...block, start: src.start, end: src.end };
    }
    return block;
  }

  const displayCurrentBlock = resolveDisplayBlock(currentBlock ?? null);
  const displayNextBlock = nextBlock && !("synthetic" in nextBlock) ? resolveDisplayBlock(nextBlock) : nextBlock;

  function jumpToBlock(id: string, source: "routine" | "commitment") {
    const target = document.getElementById(`day-block-${source}-${id}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
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

      <section className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-fade-up">
        <div className={`rounded-lg border px-4 py-3 ${
          displayCurrentBlock
            ? `${kindStyle[displayCurrentBlock.kind].blockBorder} ${kindStyle[displayCurrentBlock.kind].blockBg}`
            : "border-dashed border-border/60 bg-muted/5"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t.chronos.today.now}</div>
              <div className="mt-1 text-sm font-medium text-primary truncate">
                {currentBlock ? scheduleText.blockTitle(currentBlock.title, currentBlock.titleCustom) : emptyNowLabel}
              </div>
              <div className="mt-1 text-xs num text-muted-foreground">
                {displayCurrentBlock ? `${displayCurrentBlock.start}–${displayCurrentBlock.end} · ${fmtFriendlyDuration(durationMin(displayCurrentBlock.start, displayCurrentBlock.end), isPt)}` : "--:--"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => currentBlock && jumpToBlock(currentBlock.id, currentBlock.source)}
              disabled={!currentBlock}
              className="h-7 w-7 rounded-md border border-border/60 grid place-items-center text-muted-foreground enabled:hover:text-primary enabled:hover:border-secondary/50 disabled:opacity-40"
              aria-label="Jump to current block"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`rounded-lg border px-4 py-3 ${
          displayNextBlock
            ? `${kindStyle[displayNextBlock.kind].blockBorder} ${kindStyle[displayNextBlock.kind].blockBg}`
            : "border-dashed border-border/60 bg-muted/5"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{nextLabel}</div>
              <div className="mt-1 text-sm font-medium text-primary truncate">
                {displayNextBlock
                  ? (displayNextBlock.kind === "sleep"
                    ? (bcp47.toLowerCase().startsWith("pt") ? "Sono" : "Sleep")
                    : scheduleText.blockTitle(displayNextBlock.title, displayNextBlock.titleCustom))
                  : emptyNextLabel}
              </div>
              <div className="mt-1 text-xs num text-muted-foreground">
                {displayNextBlock
                  ? `${displayNextBlock.start}–${displayNextBlock.end} · ${fmtFriendlyDuration(durationMin(displayNextBlock.start, displayNextBlock.end), isPt)}`
                  : "--:--"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => nextBlock && !("synthetic" in nextBlock) && jumpToBlock(nextBlock.id, nextBlock.source)}
              disabled={!nextBlock || ("synthetic" in nextBlock)}
              className="h-7 w-7 rounded-md border border-border/60 grid place-items-center text-muted-foreground enabled:hover:text-primary enabled:hover:border-secondary/50 disabled:opacity-40"
              aria-label="Jump to next block"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <DayPlanner />

      <section className="mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5"><FocusBlocksCard /></div>
          <div className="lg:col-span-7"><BalanceCard /></div>
        </div>
        <div className="mt-6">
          <AetherisCard compact />
        </div>
      </section>
    </>
  );
}
