import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind, DAY_LABELS_LONG } from "@/lib/schedule/types";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface Props { trigger?: React.ReactNode; defaultKind?: BlockKind; }

export function ComposeBlockDialog({ trigger, defaultKind = "deep" }: Props) {
  const { data, addRoutine, addCommitment } = useSchedule();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"routine" | "commitment">("routine");
  const [kind, setKind] = useState<BlockKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [notes, setNotes] = useState("");

  function reset() {
    setTitle(""); setNotes(""); setStart("09:00"); setEnd("10:00"); setKind(defaultKind);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast({ title: "A block needs a title." }); return; }
    if (start >= end) { toast({ title: "End must be after start." }); return; }
    if (mode === "routine") {
      addRoutine({ day: Number(day), start, end, kind, title: title.trim(), notes: notes.trim() });
      toast({ title: "Routine block composed", description: `${DAY_LABELS_LONG[Number(day)]} · ${start}–${end}` });
    } else {
      addCommitment({ date, start, end, kind, title: title.trim(), notes: notes.trim() });
      toast({ title: "Commitment added", description: `${date} · ${start}–${end}` });
    }
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-10 bg-primary text-primary-foreground hover:bg-primary-deep">
            <Plus className="h-4 w-4 mr-1" /> Compose block
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">Compose a block</DialogTitle>
          <DialogDescription>Add a recurring routine block or a one-time commitment.</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="routine">Recurring routine</TabsTrigger>
            <TabsTrigger value="commitment">One-time</TabsTrigger>
          </TabsList>
          <form onSubmit={submit} className="space-y-4 mt-5">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Atlas · strategy memo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Category</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {data.categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <TabsContent value="routine" className="m-0 space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Day</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_LABELS_LONG.map((d, i) => (<SelectItem key={d} value={String(i)}>{d}</SelectItem>))}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="commitment" className="m-0 space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </TabsContent>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Start</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">End</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pre-read, intent, dependencies…" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary-deep">Compose</Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}