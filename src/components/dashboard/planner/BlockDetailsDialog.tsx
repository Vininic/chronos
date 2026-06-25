import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Circle, CheckCircle2 } from "lucide-react";
import { useT, useI18n, useFmtDur } from "@/lib/i18n/I18nProvider";
import { useScheduleText } from "@/lib/i18n/scheduleText";
import { useSchedule } from "@/lib/schedule/store";
import { durationMin } from "@/lib/schedule/types";
import { formatClock } from "@/lib/schedule/planner-format";
import { parseNotes, renderLinkedText, noteToneStyles } from "@/lib/schedule/planner-notes";
import { safeKindStyle } from "../widgets";
import { SessionView } from "../SessionView";
import type { AgendaItem } from "@/lib/schedule/agenda";

export function BlockDetailsDialog({
  item,
  onEdit,
  onClose,
}: {
  item: AgendaItem;
  onEdit: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const { bcp47 } = useI18n();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const { data, trackBlockForGoal, updateCommitment, updateRoutine } = useSchedule();
  const noteLines = parseNotes(item.notes);
  const kindVisual = safeKindStyle(item.kind, data.categories);
  const dialogCat = data.categories.find((c) => c.id === item.kind);
  const blockKey = item.source + "-" + (item.sourceId ?? item.id);
  const dialogGoals = data.goals.filter(
    (g) => g.categoryId === item.kind && g.autoTrackMode
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md w-[calc(100vw-2rem)] max-h-[min(80vh,calc(100dvh-3rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">
            {scheduleText.blockTitle(item.title, item.titleCustom)}
          </DialogTitle>
          <DialogDescription>
            {bcp47.toLowerCase().startsWith("pt") ? "Detalhes rapidos do bloco selecionado." : "Quick details for the selected block."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1 min-w-0">
          <div className="text-xs text-muted-foreground num">
            {formatClock(item.start, bcp47)}–{formatClock(item.end, bcp47)} · {fmtDur(durationMin(item.start, item.end))}
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.kind}</span>
            <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${kindVisual.chip} ${kindVisual.blockBorder}`} style={kindVisual.chipStyle}>
              {scheduleText.categoryLabel(item.kind, dialogCat?.label, dialogCat?.labelCustom)}
            </span>
            {item.source === "commitment" && (
              <span className="rounded border border-amber-500/30 bg-amber-500/8 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80">
                {bcp47.toLowerCase().startsWith("pt") ? "Compromisso" : "Commitment"}
              </span>
            )}
          </div>
          {(() => {
            const cat = data.categories.find((c) => c.id === item.kind);
            const structure = cat?.workspace;
            if (!structure) return null;
            return (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  {cat?.label ?? item.kind}
                </div>
                <div className="rounded-lg border border-border/40 bg-muted/10 p-3 overflow-x-auto min-w-0">
                  <SessionView
                    structure={structure}
                    runtime={
                      item.source === "commitment"
                        ? (data.commitments.find((c) => c.id === item.id)?.workspace ?? {})
                        : (data.routine.find((r) => r.id === (item.sourceId ?? item.id))?.workspace ?? {})
                    }
                    onChange={(newExt) => {
                      if (item.source === "commitment") {
                        updateCommitment(item.id, { workspace: newExt });
                      } else {
                        updateRoutine(item.id, { workspace: newExt });
                      }
                    }}
                    onClose={() => onClose()}
                  />
                </div>
              </div>
            );
          })()}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t.chronos.dialog.notes}</div>
            {noteLines.length === 0 ? (
              <div className="text-sm text-muted-foreground">-</div>
            ) : (
              <div className="space-y-1.5 text-sm leading-snug">
                {noteLines.map((line, index) => {
                  const tone = noteToneStyles[line.tone];
                  return (
                    <div key={`${line.text}-${index}`} className={`rounded border px-2 py-1 ${tone.border} ${tone.bg} ${tone.text}`}>
                      {renderLinkedText(line.text)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {dialogGoals.length > 0 && (
            <div className="border-t border-border/30 pt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tracked to goals</div>
              {dialogGoals.map((g) => {
                const mode = g.autoTrackMode ?? "always";
                const isTracked = g.trackedBlockKeys?.includes(blockKey);
                if (mode === "always") {
                  return (
                    <div key={g.id} className="flex items-center gap-2 w-full text-xs py-1.5 px-2 rounded opacity-60">
                      <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-primary font-medium">{g.title}</div>
                        <div className="text-[10px] text-muted-foreground">Always (auto-tracked)</div>
                      </div>
                    </div>
                  );
                }
                return (
                  <button key={g.id}
                    onClick={() => trackBlockForGoal(g.id, blockKey)}
                    className="flex items-center gap-2 w-full text-left text-xs py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                  >
                    {isTracked ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-primary font-medium">{g.title}</div>
                      <div className="text-[10px] text-muted-foreground">{mode === "selected" ? "Selected" : "Commitments"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          
          <DialogFooter>
            <Button type="button" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              {bcp47.toLowerCase().startsWith("pt") ? "Editar" : "Edit"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
