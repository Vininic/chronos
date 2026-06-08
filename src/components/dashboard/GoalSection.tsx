import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { useT } from "@/lib/i18n/I18nProvider";
import { GoalCard } from "./GoalCard";
import { GoalDialog, type GoalFields } from "./GoalDialog";
import type { Goal, Category, Commitment, ProgressSnapshot, RoutineBlock } from "@/lib/schedule/types";

interface Props {
  goals: Goal[];
  allGoals?: Goal[];
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
  compact?: boolean;
}

export function GoalSection({ goals, allGoals, routine, commitments, snapshots, categories, onAddGoal, onUpdateGoal, onRemoveGoal, onToggleBlock, onToggleSubTask, onAddSubTask, onAddBlock, onAssignMode, compact }: Props) {
  const t = useT();
  const g = t.chronos.goals;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

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

  if (compact) {
    const activeToday = goals;
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{g.eyebrow}</div>
          <span className="text-xs text-muted-foreground">· {g.todayGoals}</span>
        </div>
        {activeToday.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-4 text-center">
            <p className="text-xs text-muted-foreground">{g.noGoalsYet}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activeToday.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                allGoals={allGoals}
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
                compact
              />
            ))}
          </div>
        )}
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

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-[0.22em] text-secondary">{g.eyebrow}</div>
          <span className="text-xs text-muted-foreground">· {g.overview}</span>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 text-xs text-secondary hover:text-secondary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {g.addGoal}
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Target className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">{g.noGoalsYet}</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-3 text-xs text-secondary hover:underline"
          >
            {g.addGoal}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              allGoals={allGoals}
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
      )}

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
