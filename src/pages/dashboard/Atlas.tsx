import { useState } from "react";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind, durationMin, fmtDur } from "@/lib/schedule/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Atlas() {
  const { data, addCommitment, removeCommitment } = useSchedule();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [kind, setKind] = useState<BlockKind>("meeting");
  const [title, setTitle] = useState("");
  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast({ title: "A commitment needs a title." });
    if (start >= end) return toast({ title: "End must be after start." });
    addCommitment({ date, start, end, kind, title: title.trim() });
    toast({ title: "Commitment added" }); setTitle("");
  }
  const sorted = [...data.commitments].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return (
    <>
      <header className="mb-7">
        <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Atlas</div>
        <h1 className="font-display text-4xl text-primary mt-1.5">The book of commitments</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">One-time engagements that stand outside the routine.</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={add} className="chronos-card p-6 space-y-4">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">Add commitment</div>
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Investor brief · Meridian" /></div>
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Start</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">End</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Category</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{data.categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>))}</SelectContent>
            </Select></div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary-deep"><Plus className="h-4 w-4 mr-1" /> Add commitment</Button>
        </form>
        <div className="chronos-card p-6 lg:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{sorted.length} commitment{sorted.length === 1 ? "" : "s"}</div>
          <h3 className="font-display text-2xl text-primary mt-1">In the book</h3>
          {sorted.length === 0 ? <p className="mt-6 text-sm text-muted-foreground italic">No commitments yet.</p> : (
            <table className="w-full mt-5 text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground"><tr className="border-b border-border"><th className="text-left py-2">Date</th><th className="text-left">Title</th><th className="text-left">Category</th><th className="text-right">Time</th><th className="text-right">Duration</th><th /></tr></thead>
              <tbody>{sorted.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2.5 num text-muted-foreground">{c.date}</td>
                  <td className="text-primary">{c.title}</td>
                  <td className="text-muted-foreground capitalize">{c.kind}</td>
                  <td className="text-right num">{c.start}–{c.end}</td>
                  <td className="text-right num text-secondary">{fmtDur(durationMin(c.start, c.end))}</td>
                  <td className="text-right"><button onClick={() => { removeCommitment(c.id); toast({ title: "Removed" }); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
