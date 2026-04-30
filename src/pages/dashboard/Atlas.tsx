import { useState } from "react";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind, durationMin } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useDateFormat, useFmtDur, useT } from "@/lib/i18n/I18nProvider";

export default function Atlas() {
  const { data, addCommitment, removeCommitment } = useSchedule();
  const t = useT();
  const fmt = useDateFormat();
  const fmtDur = useFmtDur();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [kind, setKind] = useState<BlockKind>("meeting");
  const [title, setTitle] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast({ title: t.chronos.atlas.needsTitle });
    if (start >= end) return toast({ title: t.chronos.atlas.endAfterStart });
    addCommitment({ date, start, end, kind, title: title.trim() });
    toast({ title: t.chronos.atlas.added }); setTitle("");
  }
  const sorted = [...data.commitments].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.atlas.eyebrow}</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">{t.chronos.atlas.title}</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{t.chronos.atlas.lead}</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={add} className="chronos-card p-6 space-y-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.atlas.addEyebrow}</div>
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.atlas.titleField}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.chronos.atlas.titlePlaceholder} /></div>
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.atlas.date}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.atlas.start}</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.atlas.end}</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.atlas.category}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{data.categories.map((c) => (<SelectItem key={c.id} value={c.id}>{t.common.kinds[c.id]}</SelectItem>))}</SelectContent>
            </Select></div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary-deep"><Plus className="h-4 w-4 mr-1" /> {t.chronos.atlas.addCommitment}</Button>
        </form>
        <div className="chronos-card p-6 lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{t.chronos.atlas.countLabel(sorted.length)}</div>
          <h3 className="font-display text-2xl text-primary mt-1">{t.chronos.atlas.inTheBook}</h3>
          {sorted.length === 0 ? <p className="mt-6 text-sm text-muted-foreground italic">{t.chronos.atlas.empty}</p> : (
            <table className="w-full mt-5 text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground"><tr className="border-b border-border"><th className="text-left py-2">{t.chronos.atlas.colDate}</th><th className="text-left">{t.chronos.atlas.colTitle}</th><th className="text-left">{t.chronos.atlas.colCategory}</th><th className="text-right">{t.chronos.atlas.colTime}</th><th className="text-right">{t.chronos.atlas.colDuration}</th><th /></tr></thead>
              <tbody>{sorted.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2.5 num text-muted-foreground">{fmt.fromISO(c.date)}</td>
                  <td className="text-primary">{c.title}</td>
                  <td className="text-muted-foreground">{t.common.kinds[c.kind]}</td>
                  <td className="text-right num">{c.start}–{c.end}</td>
                  <td className="text-right num text-secondary">{fmtDur(durationMin(c.start, c.end))}</td>
                  <td className="text-right"><button onClick={() => { removeCommitment(c.id); toast({ title: t.chronos.atlas.removed }); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
