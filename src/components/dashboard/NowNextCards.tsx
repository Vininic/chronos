import { useSchedule } from "@/lib/schedule/store";
import { safeKindStyle } from "./widgets";
import { useT } from "@/lib/i18n/I18nProvider";
import type { useScheduleText } from "@/lib/i18n/scheduleText";
import { formatClock, fmtFriendlyDuration } from "@/lib/schedule/planner-format";
import { durationMin } from "@/lib/schedule/types";
import { ChevronDown } from "lucide-react";

export type NowNextBlock = {
  id: string;
  kind: string;
  start: string;
  end: string;
  title: string;
  titleCustom?: string;
  source: "routine" | "commitment";
};

interface NowNextCardsProps {
  t: ReturnType<typeof useT>;
  displayCurrentBlock: NowNextBlock | null;
  displayNextBlock: NowNextBlock | null;
  currentBlock: NowNextBlock | null;
  nextBlock: NowNextBlock | null;
  jumpToBlock: (id: string, source: "routine" | "commitment", kind?: string) => void;
  nextLabel: string;
  emptyNowLabel: string;
  emptyNextLabel: string;
  fmtFriendlyDuration: (totalMin: number, isPt: boolean) => string;
  isPt: boolean;
  scheduleText: ReturnType<typeof useScheduleText>;
  bcp47: string;
  isNextFromTomorrow: boolean;
}

export function NowNextCards({
  t, displayCurrentBlock, displayNextBlock, currentBlock, nextBlock, jumpToBlock,
  nextLabel, emptyNowLabel, emptyNextLabel, fmtFriendlyDuration, isPt, scheduleText, bcp47, isNextFromTomorrow,
}: NowNextCardsProps) {
  const { data } = useSchedule();
  function cardStyle(kind: string) {
    if (kind === "sleep") return { className: "border-primary/35 bg-muted/45", style: undefined as React.CSSProperties | undefined };
    const ns = safeKindStyle(kind, data.categories);
    return { className: `${ns.blockBorder} ${ns.blockBg}`, style: ns.blockStyle };
  }

  const currentCard = displayCurrentBlock ? cardStyle(displayCurrentBlock.kind) : null;
  const nextCard = displayNextBlock ? cardStyle(displayNextBlock.kind) : null;
  return (
    <section className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-fade-up">
      <div className={`rounded-lg border px-4 py-3 ${currentCard?.className ?? "border-dashed border-border/60 bg-muted/5"}`} style={currentCard?.style}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t.chronos.today.now}</div>
            <div className="mt-1 text-sm font-medium text-primary truncate">{currentBlock ? (currentBlock.kind === "sleep" ? scheduleText.categoryLabel("sleep", currentBlock.title, currentBlock.titleCustom) : scheduleText.blockTitle(currentBlock.title, currentBlock.titleCustom)) : emptyNowLabel}</div>
            <div className="mt-1 text-xs num text-muted-foreground">{displayCurrentBlock ? `${formatClock(displayCurrentBlock.start, bcp47)}–${formatClock(displayCurrentBlock.end, bcp47)} · ${fmtFriendlyDuration(durationMin(displayCurrentBlock.start, displayCurrentBlock.end), isPt)}` : "--:--"}</div>
          </div>
          <button type="button" onClick={() => currentBlock && jumpToBlock(currentBlock.id, currentBlock.source, currentBlock.kind)} disabled={!currentBlock} className="h-7 w-7 rounded-md border border-border/60 grid place-items-center text-muted-foreground enabled:hover:text-primary enabled:hover:border-secondary/50 disabled:opacity-40"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>
      <div className={`rounded-lg border px-4 py-3 ${nextCard?.className ?? "border-dashed border-border/60 bg-muted/5"}`} style={nextCard?.style}>
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
