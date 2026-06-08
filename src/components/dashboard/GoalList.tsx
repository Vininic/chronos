import { useState, useMemo } from "react";
import { Target, Plus, Filter, ArrowUpDown } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { GoalCard } from "./GoalCard";
import { GoalDialog, type GoalFields } from "./GoalDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Goal, Category, Commitment, ProgressSnapshot, RoutineBlock } from "@/lib/schedule/types";
import { computeGoalProgress } from "@/lib/schedule/types";

type SortKey = "newest" | "oldest" | "progress";

interface Props {
  goals: Goal[];
  routine?: RoutineBlock[];
  commitments?: Commitment[];
  snapshots?: ProgressSnapshot[];
  categories: Category[];
  onAddGoal: (g: GoalFields) => void;
  onUpdateGoal: (id: string, patch: Partial<Goal>) => void;
  onRemoveGoal: (id: string) => void;
  onToggleBlock: (goalId: string, blockId: string) => void;
  onToggleSubTask: (goalId: string, subTaskId: string) => void;
  onAddSubTask?: (goalId: string, title: string) => void;
  onAddBlock?: (goalId: string, duration?: number) => void;
  onAssignMode?: (goalId: string) => void;
}

export function GoalList({ goals, routine, commitments, snapshots, categories, onAddGoal, onUpdateGoal, onRemoveGoal, onToggleBlock, onToggleSubTask, onAddSubTask, onAddBlock, onAssignMode }: Props) {
  const t = useT();
  const g = t.chronos.goals;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const sorted = useMemo(() => {
    let filtered = goals;
    if (kindFilter !== "all") {
      filtered = goals.filter((goal) => goal.kind === kindFilter);
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return computeGoalProgress(a, undefined, goals, undefined, commitments).ratio - computeGoalProgress(b, undefined, goals, undefined, commitments).ratio;
    });
  }, [goals, kindFilter, sortBy, commitments]);

  function handleEdit(goal: Goal) {
    setEditingGoal(goal);
    setDialogOpen(true);
  }

  function handleSave(fields: GoalFields) {
    if (editingGoal) {
      onUpdateGoal(editingGoal.id, fields);
    } else {
      onAddGoal(fields);
    }
    setEditingGoal(null);
  }

  function handleClose() {
    setDialogOpen(false);
    setEditingGoal(null);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{g.eyebrow}</div>
          <h2 className="font-display text-2xl text-primary mt-1">{g.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{g.lead}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          {g.addGoal}
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>{g.filter}</span>
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{g.allGoals}</SelectItem>
            <SelectItem value="numeric">{g.kindNumeric}</SelectItem>
            <SelectItem value="duration">{g.kindDuration}</SelectItem>
            <SelectItem value="deadline">{g.kindDeadline}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground ml-2">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span>{g.sort}</span>
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{g.sortNewest}</SelectItem>
            <SelectItem value="oldest">{g.sortOldest}</SelectItem>
            <SelectItem value="progress">{g.sortProgress}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-6 text-center">
          <Target className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">{g.noGoalsYet}</p>
        </div>
      ) : (
        <><div className="space-y-2">
          {sorted.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              allGoals={goals}
              routine={routine}
              commitments={commitments}
              snapshots={snapshots}
              onEdit={handleEdit}
              onRemove={onRemoveGoal}
              onToggleBlock={onToggleBlock}
              onToggleSubTask={onToggleSubTask}
              onAddSubTask={onAddSubTask}
              onAddBlock={onAddBlock}
              onAssignMode={onAssignMode}
            />
          ))}
        </div>
        <button onClick={() => setDialogOpen(true)}
          className="w-full mt-3 border-2 border-dashed border-border/40 rounded-lg py-5 flex items-center justify-center gap-2 text-sm text-muted-foreground/50 hover:text-muted-foreground hover:border-muted-foreground/30 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {g.addGoal}
        </button>
        </>)}

      <GoalDialog
        open={dialogOpen}
        onClose={handleClose}
        onSave={handleSave}
        initial={editingGoal ?? undefined}
        categories={categories}
      />
    </section>
  );
}
