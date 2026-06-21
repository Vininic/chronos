import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Goal, GoalKind, GoalTracking, GoalPeriod, GoalAutoTrackMode, Category } from "@/lib/schedule/types";
import { GOAL_TRACKING_BY_KIND, getValidGoalPeriods, getDefaultGoalPeriod } from "@/lib/schedule/types";
import { Hash, Clock, Target, CalendarDays, X, RefreshCw, CheckSquare, ListTodo } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (goal: GoalFields) => void;
  initial?: Goal;
  categories: Category[];
}

export interface GoalFields {
  kind: GoalKind;
  tracking: GoalTracking;
  title: string;
  description?: string;
  categoryId?: string;
  target: number;
  unit?: string;
  period: GoalPeriod;
  deadline?: string;
  startDate: string;
  weight: number;
  color?: string;
  autoTrackMode?: GoalAutoTrackMode;
}

const kindMeta = [
  { value: "numeric" as GoalKind, icon: Hash, label: "Count", desc: "N check-ins or units per period" },
  { value: "duration" as GoalKind, icon: Clock, label: "Duration", desc: "N hours per period" },
  { value: "deadline" as GoalKind, icon: CalendarDays, label: "Deadline", desc: "Complete by a date" },
];

const trackMeta = [
  { value: "none" as GoalTracking, icon: CalendarDays, label: "Milestone", desc: "Auto-completes on deadline date" },
  { value: "goalBlock" as GoalTracking, icon: Hash, label: "Check-ins", desc: "Count completed check-ins" },
  { value: "quota" as GoalTracking, icon: Clock, label: "Duration", desc: "Sum of block hours" },
  { value: "subTask" as GoalTracking, icon: Target, label: "Subtasks", desc: "Complete subtask list" },
  { value: "category" as GoalTracking, icon: CalendarDays, label: "Auto-track", desc: "Track from category blocks" },
];

const periodMeta = [
  { value: "daily" as "daily" | "weekly" | "monthly" | "total", icon: Hash, label: "Daily", desc: "Reset daily" },
  { value: "weekly" as "daily" | "weekly" | "monthly" | "total", icon: Clock, label: "Weekly", desc: "Reset weekly" },
  { value: "monthly" as "daily" | "weekly" | "monthly" | "total", icon: Target, label: "Monthly", desc: "Reset monthly" },
  { value: "total" as "daily" | "weekly" | "monthly" | "total", icon: CalendarDays, label: "Total", desc: "Never resets" },
];

const VALID_TRACKING = GOAL_TRACKING_BY_KIND;

const COLOR_FAMILIES = [
  { family: "Crimson", shades: ["#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c"] },
  { family: "Rose", shades: ["#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c"] },
  { family: "Amber", shades: ["#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309"] },
  { family: "Chartreuse", shades: ["#bef264", "#a3e635", "#84cc16", "#65a30d", "#4d7c0f"] },
  { family: "Emerald", shades: ["#6ee7b7", "#34d399", "#10b981", "#059669", "#047857"] },
  { family: "Teal", shades: ["#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e"] },
  { family: "Sky", shades: ["#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1"] },
  { family: "Violet", shades: ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9"] },
  { family: "Indigo", shades: ["#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca"] },
  { family: "Slate", shades: ["#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155"] },
];

function CardGrid<T extends string>({ options, value, onChange }: {
  options: { value: T; icon: React.ElementType; label: string; desc: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            className={`rounded-lg border py-1.5 text-center transition-colors ${selected ? "border-secondary bg-secondary/10" : "border-border/60 hover:border-border hover:bg-muted/50"}`}
          >
            <Icon className={`h-3 w-3 mx-auto mb-0.5 ${selected ? "text-secondary" : "text-muted-foreground"}`} />
            <div className={`text-[10px] font-medium leading-tight ${selected ? "text-primary" : "text-muted-foreground"}`}>{opt.label}</div>
            <div className="text-[8px] text-muted-foreground leading-tight mt-0.5">{opt.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

export function GoalDialog({ open, onClose, onSave, initial, categories }: Props) {
  const t = useT();
  const g = t.chronos.goals;
  const today = new Date().toISOString().slice(0, 10);
  const [kind, setKind] = useState<GoalKind>(initial?.kind ?? "numeric");

  const [tracking, setTracking] = useState<GoalTracking>(initial?.tracking ?? "goalBlock");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [target, setTarget] = useState(initial ? String(initial.target) : "10");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [period, setPeriod] = useState(initial?.period ?? "weekly");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? today);
  const [weight, setWeight] = useState(initial ? String(initial.weight) : "5");
  const [color, setColor] = useState(initial?.color ?? "");
  const [showStartDate, setShowStartDate] = useState(!!initial);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [autoTrackMode, setAutoTrackMode] = useState<"always" | "selected" | "commitments">(initial?.autoTrackMode ?? "always");

  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? "numeric");
    setTracking(initial?.tracking ?? "goalBlock");
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setTarget(initial ? String(initial.target) : "10");
    setUnit(initial?.unit ?? "");
    setPeriod(initial?.period ?? "weekly");
    setDeadline(initial?.deadline ?? "");
    setStartDate(initial?.startDate ?? today);
    setWeight(initial ? String(initial.weight) : "5");
    setColor(initial?.color ?? "");
    setShowStartDate(!!initial);
    setCategoryId(initial?.categoryId ?? "");
    setAutoTrackMode(initial?.autoTrackMode ?? "always");
  }, [open, initial]);

  const autoTrackCategory = tracking === "category";
  const validTracking = VALID_TRACKING[kind];
  const validPeriods = getValidGoalPeriods(kind, tracking);

  useEffect(() => {
    setTracking((prev) => {
      const valid = VALID_TRACKING[kind];
      return valid.includes(prev) ? prev : valid[0];
    });
  }, [kind]);

  useEffect(() => {
    setPeriod((prev) => {
      const valid = getValidGoalPeriods(kind, tracking);
      return valid.includes(prev as GoalPeriod) ? prev : getDefaultGoalPeriod(kind, tracking);
    });
  }, [kind, tracking]);

  function handleSave() {
    if (!title.trim()) return;
    onSave({
      kind,
      tracking,
      title: title.trim(),
      description: description.trim() || undefined,
      categoryId: tracking === "category" ? (categoryId || undefined) : undefined,
      autoTrackMode: tracking === "category" ? autoTrackMode : undefined,
      target: Number(target) || 0,
      unit: unit.trim() || undefined,
      period,
      deadline: (kind === "deadline" && deadline) ? deadline : undefined,
      startDate: showStartDate ? startDate : today,
      weight: Math.max(1, Math.min(10, Number(weight) || 5)),
      color: color || undefined,
    });
    onClose();
  }

  const isCustomColor = color && !COLOR_FAMILIES.some((f) => f.shades.includes(color));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-primary">{initial ? g.editGoal : g.addGoal}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1 overflow-y-auto max-h-[60vh] pr-1">

          <div className="space-y-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={g.titlePlaceholder} className="h-9" />
          </div>
          <div className="space-y-1">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={g.descriptionPlaceholder ?? "Description (optional)"} className="min-h-[60px] text-xs resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.kind}</Label>
            <CardGrid options={kindMeta} value={kind} onChange={(v) => { setKind(v); setPeriod(v === "numeric" ? "daily" : v === "deadline" ? "total" : "weekly"); }} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.tracking}</Label>
            <CardGrid options={trackMeta.filter((m) => validTracking.includes(m.value as GoalTracking))} value={tracking} onChange={(v) => setTracking(v as GoalTracking)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.period}</Label>
            <CardGrid options={periodMeta.filter((p) => validPeriods.includes(p.value))} value={period} onChange={(v) => setPeriod(v as typeof period)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.target}</Label>
              <div className="flex gap-1.5">
                <Input type="number" min={0} value={target} onChange={(e) => setTarget(e.target.value)} className="h-8 flex-1" />
                {kind === "numeric" && (
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={g.unitPlaceholder} className="h-8 w-32" />
                )}
              </div>
              <p className="text-[9px] text-muted-foreground leading-tight">{tracking === "none" ? "auto-completes on deadline date" : tracking === "goalBlock" ? (kind === "deadline" ? "total check-ins before deadline" : `${kind === "numeric" ? (unit || "units") : "check-ins"} per ${period}`) : tracking === "quota" ? "hours per period" : tracking === "subTask" ? "subtask items" : "category blocks"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.weight}</Label>
              <Input type="number" min={1} max={10} value={weight} onChange={(e) => setWeight(e.target.value)} className="h-8 w-full" />
              <p className="text-[9px] text-muted-foreground leading-tight">1–10, higher = more influence</p>
            </div>
          </div>

          {kind === "deadline" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.deadline}</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-9 w-44" />
            </div>
          )}

          {autoTrackCategory && (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCategoryId(categoryId === c.id ? "" : c.id)}
                    className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${categoryId === c.id ? "border-secondary bg-secondary/10 text-primary font-medium" : "border-border/60 text-muted-foreground hover:border-border"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="pt-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Auto-track mode</Label>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {[
                    { value: "always" as const, icon: RefreshCw, label: "Always", desc: "Count all occurrences" },
                    { value: "selected" as const, icon: CheckSquare, label: "Selected", desc: "Pick specific blocks" },
                    { value: "commitments" as const, icon: ListTodo, label: "Commitments", desc: `Generate ${target} slots` },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const selected = autoTrackMode === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setAutoTrackMode(opt.value)}
                        className={`rounded-lg border py-1.5 text-center transition-colors ${selected ? "border-secondary bg-secondary/10" : "border-border/60 hover:border-border hover:bg-muted/50"}`}
                      >
                        <Icon className={`h-3 w-3 mx-auto mb-0.5 ${selected ? "text-secondary" : "text-muted-foreground"}`} />
                        <div className={`text-[10px] font-medium leading-tight ${selected ? "text-primary" : "text-muted-foreground"}`}>{opt.label}</div>
                        <div className="text-[8px] text-muted-foreground leading-tight mt-0.5">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Color</Label>
            <div className="rounded-lg border border-border/60 bg-card p-2 space-y-1.5">
              <div className="grid grid-cols-5 gap-0.5">
                {COLOR_FAMILIES.map((fam) => (
                  fam.shades.map((s) => (
                    <button key={s} type="button" onClick={() => setColor(color === s ? "" : s)}
                      className={`h-5 w-full rounded-[2px] border transition-all ${color === s ? "ring-2 ring-offset-1 ring-secondary" : "border-border/40"}`}
                      style={{ backgroundColor: s }}
                      title={fam.family}
                    />
                  ))
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted-foreground">Custom:</span>
                <input type="color" value={color || "#f59e0b"} onChange={(e) => setColor(e.target.value)}
                  className="h-5 w-8 rounded border border-border/60 cursor-pointer p-0.5" />
                {isCustomColor && (
                  <span className="text-[9px] font-mono text-muted-foreground">{color}</span>
                )}
                {color && (
                  <button type="button" onClick={() => setColor("")} className="text-muted-foreground hover:text-primary ml-auto">
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer" htmlFor="start-date-toggle">
              {g.startDate}
            </Label>
            <Switch id="start-date-toggle" checked={showStartDate} onCheckedChange={setShowStartDate} />
          </div>
          {showStartDate && (
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-44 text-xs" />
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>{t.chronos.dialog.cancel}</Button>
          <Button size="sm" onClick={handleSave} disabled={!title.trim()}>{t.common.save}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
