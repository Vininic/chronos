import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchedule } from "@/lib/schedule/store";
import { BlockKind } from "@/lib/schedule/types";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";

interface Props { trigger?: React.ReactNode; defaultKind?: BlockKind; }

export function ComposeBlockDialog({ trigger, defaultKind = "deep" }: Props) {
  const { data, addRoutine, addCommitment } = useSchedule();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"routine" | "commitment">("routine");
  const [kind, setKind] = useState<BlockKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState(String(new Date().getDay()));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [notes, setNotes] = useState("");

  function reset() {
    setTitle(""); setNotes(""); setStart("09:00"); setEnd("10:00"); setKind(defaultKind);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { toast({ title: t.chronos.dialog.needsTitle }); return; }
    if (start >= end) { toast({ title: t.chronos.dialog.endAfterStart }); return; }
    if (mode === "routine") {
      addRoutine({ day: Number(day), start, end, kind, title: title.trim(), notes: notes.trim() });
      toast({ title: t.chronos.dialog.routineAdded, description: `${t.common.days.long[Number(day)]} · ${start}–${end}` });
    } else {
      addCommitment({ date, start, end, kind, title: title.trim(), notes: notes.trim() });
      toast({ title: t.chronos.dialog.commitmentAdded, description: `${date} · ${start}–${end}` });
    }
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="h-9 bg-primary text-primary-foreground hover:bg-primary-deep">
            <Plus className="h-4 w-4 mr-1" /> {t.common.composeBlock}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">{t.chronos.dialog.title}</DialogTitle>
          <DialogDescription>{t.chronos.dialog.desc}</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="routine">{t.chronos.dialog.tabRoutine}</TabsTrigger>
            <TabsTrigger value="commitment">{t.chronos.dialog.tabCommitment}</TabsTrigger>
          </TabsList>
          <form onSubmit={submit} className="space-y-4 mt-5">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.title_field}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.chronos.dialog.titlePlaceholder} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.kind}</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as BlockKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {data.categories.map((c) => (<SelectItem key={c.id} value={c.id}>{t.common.kinds[c.id]}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <TabsContent value="routine" className="m-0 space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.day}</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {t.common.days.long.map((d, i) => (<SelectItem key={d} value={String(i)}>{d}</SelectItem>))}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="commitment" className="m-0 space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.date}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </TabsContent>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.start}</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.end}</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{t.chronos.dialog.notes}</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.chronos.dialog.notesPlaceholder} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t.chronos.dialog.cancel}</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary-deep">{t.chronos.dialog.submit}</Button>
            </DialogFooter>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
