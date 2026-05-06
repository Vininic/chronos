import { useEffect, useRef, useState } from "react";
import { useSchedule, buildAgendaForDate } from "@/lib/schedule/store";
import { BlockKind, durationMin, timeToMinutes } from "@/lib/schedule/types";
import { kindStyle } from "./widgets";
import { useFmtDur, useT } from "@/lib/i18n/I18nProvider";
import { isKnownDefaultBlockTitle, useScheduleText } from "@/lib/i18n/scheduleText";
import { ChevronDown, Trash2, Clock, Minus, Plus } from "lucide-react";
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
  const scheduleText = useScheduleText();
  // Not memoized — a stale date across midnight would show the wrong day's agenda
  const today = new Date();
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

  useEffect(() => {
    setExpandedId((prev) => {
      if (prev && agenda.some((a) => a.id === prev)) return prev;
      return liveId ?? agenda[0]?.id ?? null;
    });
  }, [agenda, liveId]);

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
                className="absolute left-0 right-0 z-0 border-t border-border/50"
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
                className="absolute left-[68px] right-4 z-10 pointer-events-none"
                style={{ top: topFor(nowMin) }}
              >
                <div className="h-px bg-secondary/75" />
                <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-secondary ring-2 ring-card shadow-bronze" />
                <div className="absolute right-0 -top-4 text-[10px] uppercase tracking-wider text-secondary/80 bg-card px-1.5 py-0.5 rounded">
                  {t.chronos.today.now}
                </div>
              </div>
            )}

            {/* blocks */}
            <div className="absolute left-[68px] right-4 top-0 bottom-0 z-20">
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
                          <span className="text-sm font-medium text-primary truncate">{scheduleText.blockTitle(a.title, a.titleCustom)}</span>
                          <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <BlockEditor
                        agendaItem={a}
                        onSave={(patch) => {
                          const error = isCommitment ? updateCommitment(a.id, patch) : updateRoutine(a.id, patch);
                          if (error) {
                            toast({ title: "Scheduling conflict", description: error });
                            return;
                          }
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
  titleCustom?: string;
  source: "routine" | "commitment";
  notes?: string;
}

function nudgeTime(current: string, deltaMin: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 45, timeToMinutes(current) + deltaMin));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function TimeNudgeField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(nudgeTime(value, -15))}
          aria-label={`Diminuir ${label} em 15 minutos`}
          className="h-9 w-7 rounded-md border border-border bg-card hover:bg-secondary/10 flex items-center justify-center text-muted-foreground hover:text-primary"
        >
          <Minus className="h-3 w-3" />
        </button>
        <Input
          type="time"
          step={900}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 num flex-1 min-w-0"
        />
        <button
          type="button"
          onClick={() => onChange(nudgeTime(value, 15))}
          aria-label={`Aumentar ${label} em 15 minutos`}
          className="h-9 w-7 rounded-md border border-border bg-card hover:bg-secondary/10 flex items-center justify-center text-muted-foreground hover:text-primary"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function BlockEditor({ agendaItem, onSave, onRemove }:
  { agendaItem: AgendaItem; onSave: (patch: any) => void; onRemove: () => void }) {
  const { data } = useSchedule();
  const t = useT();
  const fmtDur = useFmtDur();
  const scheduleText = useScheduleText();
  const [title, setTitle] = useState(scheduleText.blockTitle(agendaItem.title, agendaItem.titleCustom));
  const [start, setStart] = useState(agendaItem.start);
  const [end, setEnd] = useState(agendaItem.end);
  const [kind, setKind] = useState<BlockKind>(agendaItem.kind);

  // Load notes from the actual source block
  const sourceNotes = (() => {
    if (agendaItem.source === "commitment") {
      return data.commitments.find((c) => c.id === agendaItem.id)?.notes ?? "";
    }
    return data.routine.find((r) => r.id === agendaItem.id)?.notes ?? "";
  })();
  const [notes, setNotes] = useState(sourceNotes);

  const durMin = end > start ? durationMin(start, end) : 0;

  function save() {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    if (start >= end) { toast({ title: t.chronos.dialog.endAfterStart }); return; }
    const localizedDefaultTitle = scheduleText.blockTitle(agendaItem.title);
    const patch = {
      start,
      end,
      kind,
      notes: notes.trim(),
      title: agendaItem.title,
      titleCustom:
        isKnownDefaultBlockTitle(agendaItem.title)
          ? (nextTitle === localizedDefaultTitle ? undefined : nextTitle)
          : undefined,
    };

    if (!isKnownDefaultBlockTitle(agendaItem.title)) {
      onSave({ ...patch, title: nextTitle });
      return;
    }

    onSave(patch);
  }

  return (
    <div className="border-t border-border/60 bg-surface-raised p-4 space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.title_field}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TimeNudgeField label={t.chronos.dialog.start} value={start} onChange={setStart} />
        <TimeNudgeField label={t.chronos.dialog.end} value={end} onChange={setEnd} />
      </div>
      <div className="flex items-center justify-between">
        <div className="space-y-1.5 flex-1 mr-3">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.chronos.dialog.kind}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {scheduleText.categoryLabel(c.id, c.label || t.common.kinds[c.id], c.labelCustom)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {durMin > 0 && (
          <div className="text-right shrink-0 pt-5">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{t.chronos.today.duration}</div>
            <div className="font-display text-lg text-secondary num">{fmtDur(durMin)}</div>
          </div>
        )}
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
