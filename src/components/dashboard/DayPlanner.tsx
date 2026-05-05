import { useEffect, useMemo, useRef, useState } from "react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { BlockKind, durationMin, timeToMinutes } from "@/lib/schedule/types";
import { kindStyle } from "./widgets";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";
import { ChevronDown, Trash2, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ComposeBlockDialog } from "./ComposeBlockDialog";

const HOUR_PX = 56;
const START_HOUR = 6;
const END_HOUR = 23;

export function DayPlanner() {
  const { data, removeRoutine, updateRoutine, removeCommitment, updateCommitment } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const today = useMemo(() => new Date(), []);
  const agenda = buildAgendaForDate(data, today);
  const totalMin = agenda.reduce((s, a) => s + durationMin(a.start, a.end), 0);

  // Live "now" line
  const [nowMin, setNowMin] = useState(() => today.getHours() * 60 + today.getMinutes());
  useEffect(() => {
    const id = window.setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const liveId = agenda.find((a) => timeToMinutes(a.start) <= nowMin && nowMin < timeToMinutes(a.end))?.id;
  const [expandedId, setExpandedId] = useState<string | null>(liveId ?? agenda[0]?.id ?? null);

  const gridRef = useRef<HTMLDivElement>(null);
  function jumpToNow() {
    if (!gridRef.current) return;
    const offset = ((nowMin / 60) - START_HOUR) * HOUR_PX - 120;
    gridRef.current.parentElement?.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
  }

  const totalHeight = (END_HOUR - START_HOUR) * HOUR_PX;
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  function topFor(min: number) { return ((min / 60) - START_HOUR) * HOUR_PX; }

  return (
    <div className="chronos-card p-0 overflow-hidden">
      <div className="flex items-end justify-between gap-3 px-6 pt-6 pb-4 border-b border-border/60">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.widgets.dailyAgenda}</div>
          <h2 className="font-display text-2xl text-primary mt-1">{t.chronos.widgets.dailyTitle}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            <span className="num">{t.chronos.widgets.movements(agenda.length)}</span> · <span className="num">{fmtDur(totalMin)}</span>
          </span>
          <Button variant="outline" size="sm" onClick={jumpToNow} className="h-8">
            <Clock className="h-3.5 w-3.5 mr-1" /> {t.chronos.today.jumpToNow}
          </Button>
          <ComposeBlockDialog />
        </div>
      </div>

      {agenda.length === 0 ? (
        <div className="m-6 rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">{t.chronos.today.noBlocks}</p>
          <div className="mt-3"><ComposeBlockDialog /></div>
        </div>
      ) : (
        <div className="max-h-[640px] overflow-y-auto">
          <div ref={gridRef} className="relative" style={{ height: totalHeight }}>
            {/* hour grid */}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-border/50"
                style={{ top: (h - START_HOUR) * HOUR_PX }}
              >
                <span className="absolute -top-2 left-3 text-[10px] num text-muted-foreground/70 bg-card px-1">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}

            {/* now line */}
            {nowMin / 60 >= START_HOUR && nowMin / 60 <= END_HOUR && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: topFor(nowMin) }}
              >
                <div className="h-px bg-secondary" />
                <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-secondary shadow-bronze" />
              </div>
            )}

            {/* blocks */}
            <div className="absolute left-[68px] right-4 top-0 bottom-0">
              {agenda.map((a) => {
                const sm = timeToMinutes(a.start);
                const em = timeToMinutes(a.end);
                const top = topFor(sm);
                const height = Math.max(28, ((em - sm) / 60) * HOUR_PX - 4);
                const s = kindStyle[a.kind];
                const live = a.id === liveId;
                const expanded = a.id === expandedId;
                const isCommitment = a.source === "commitment";
                return (
                  <div
                    key={a.id}
                    className={`absolute left-0 right-0 rounded-lg border bg-card shadow-sm overflow-hidden transition-all ${
                      live ? "border-secondary ring-2 ring-secondary/20" : "border-border hover:border-secondary/40"
                    }`}
                    style={{ top, minHeight: height, zIndex: expanded ? 30 : 10 }}
                  >
                    <button
                      onClick={() => setExpandedId(expanded ? null : a.id)}
                      className="w-full text-left flex items-stretch gap-3"
                    >
                      <div className={`w-1 ${s.dot}`} />
                      <div className="flex-1 min-w-0 py-2.5 pr-3 pl-1">
                        <div className="flex items-center gap-2 text-[11px] num text-muted-foreground">
                          <span>{a.start}–{a.end}</span>
                          <span>·</span>
                          <span>{fmtDur(em - sm)}</span>
                          {live && <span className="text-secondary font-medium uppercase tracking-wider">· {t.chronos.today.now}</span>}
                          {isCommitment && <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">{t.chronos.today.commitmentTag}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.chip} font-medium`}>{t.common.kinds[a.kind]}</span>
                          <span className="text-sm font-medium text-primary truncate">{a.title}</span>
                          <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <BlockEditor
                        agendaItem={a}
                        onSave={(patch) => {
                          if (isCommitment) updateCommitment(a.id, patch);
                          else updateRoutine(a.id, patch);
                          toast({ title: t.common.save });
                        }}
                        onRemove={() => {
                          if (isCommitment) removeCommitment(a.id);
                          else removeRoutine(a.id);
                          toast({ title: t.chronos.widgets.blockRemoved });
                          setExpandedId(null);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AgendaItem {
  id: string; title: string; start: string; end: string; kind: BlockKind;
  source: "routine" | "commitment";
}

function BlockEditor({ agendaItem, onSave, onRemove }:
  { agendaItem: AgendaItem; onSave: (patch: any) => void; onRemove: () => void }) {
  const { data } = useSchedule();
  const t = useT();
  const [title, setTitle] = useState(agendaItem.title);
  const [start, setStart] = useState(agendaItem.start);
  const [end, setEnd] = useState(agendaItem.end);
  const [kind, setKind] = useState<BlockKind>(agendaItem.kind);
  const [notes, setNotes] = useState("");

  function save() {
    if (!title.trim() || start >= end) return;
    onSave({ title: title.trim(), start, end, kind, notes });
  }

  return (
    <div className="border-t border-border/60 bg-surface-raised p-4 space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.title_field}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.start}</Label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 num" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.end}</Label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 num" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.kind}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.categories.map((c) => (<SelectItem key={c.id} value={c.id}>{t.common.kinds[c.id]}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.today.notes}</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.chronos.dialog.notesPlaceholder} className="resize-none" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <button onClick={onRemove} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> {t.chronos.today.removeBlock}
        </button>
        <Button size="sm" onClick={save} className="h-8 bg-primary text-primary-foreground hover:bg-primary-deep">
          {t.common.save}
        </Button>
      </div>
    </div>
  );
}
