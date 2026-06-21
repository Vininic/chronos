import { Pencil, Trash2, Target, Clock, CalendarDays, CheckCircle2, Square, Plus, ListTodo, RefreshCw, Flame, TrendingUp } from "lucide-react";
import type { Goal, Commitment, ProgressSnapshot, RoutineBlock } from "@/lib/schedule/types";
import { fmtDur, computeGoalProgress, computeStreak, daysUntilDeadline } from "@/lib/schedule/types";
import { ProgressChart } from "./ProgressChart";
import { useT } from "@/lib/i18n/I18nProvider";
import { useState } from "react";

const kindIcons: Record<string, React.ElementType> = {
  duration: Clock,
  numeric: Target,
  deadline: CalendarDays,
};

const kindBadgeColors: Record<string, string> = {
  duration: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  numeric: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  deadline: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
};

function ProgressRing({ ratio, size = 40, strokeWidth = 3, color }: { ratio: number; size?: number; strokeWidth?: number; color: string }) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(1, ratio));
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted" opacity={0.2} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-500"
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.25} fill="currentColor" className="text-primary font-medium">
        {Math.round(ratio * 100)}%
      </text>
    </svg>
  );
}

function SegmentedProgress({ numerator, denominator, color }: { numerator: number; denominator: number; color: string }) {
  const total = Math.min(Math.max(denominator, 1), 20);
  const filled = Math.min(numerator, total);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-2 flex-1 rounded-[2px] transition-colors ${i < filled ? "" : "bg-muted"}`}
          style={i < filled ? { backgroundColor: color } : undefined}
        />
      ))}
      {denominator > 20 && (
        <span className="text-[10px] text-muted-foreground ml-1">+{denominator - 20}</span>
      )}
    </div>
  );
}

interface Props {
  goal: Goal;
  allGoals?: Goal[];
  routine?: RoutineBlock[];
  commitments?: Commitment[];
  snapshots?: ProgressSnapshot[];
  onEdit: (g: Goal) => void;
  onRemove: (id: string) => void;
  onToggleBlock: (goalId: string, blockId: string) => void;
  onToggleSubTask: (goalId: string, subTaskId: string) => void;
  onAddSubTask?: (goalId: string, title: string) => void;
  onAddBlock?: (goalId: string, duration?: number) => void;
  onAssignMode?: (goalId: string) => void;
  compact?: boolean;
}

export function GoalCard({ goal, allGoals, routine, commitments, snapshots, onEdit, onRemove, onToggleBlock, onToggleSubTask, onAddSubTask, onAddBlock, onAssignMode, compact }: Props) {
  const t = useT();
  const g = t.chronos.goals;
  const todayIso = new Date().toISOString().slice(0, 10);
  const progress = computeGoalProgress(goal, todayIso, allGoals, routine, commitments);
  const [blockDuration, setBlockDuration] = useState(60);
  const [newSubTask, setNewSubTask] = useState("");
  const Icon = kindIcons[goal.kind] ?? Target;
  const periodLabel = (g[`period${goal.period.charAt(0).toUpperCase() + goal.period.slice(1)}` as keyof typeof g] as string | undefined) ?? goal.period;
  const accentColor = goal.color ?? "hsl(var(--secondary))";
  const bgTint = goal.color ? `${goal.color}20` : "hsl(var(--secondary) / 0.12)";
  const doneBlocks = goal.blocks.filter((b) => b.done);
  const ongoingBlocks = goal.blocks.filter((b) => !b.done && b.date === todayIso);

  return (
    <div data-goal-id={goal.id} className="chronos-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        {goal.kind === "deadline" ? (
          <ProgressRing ratio={progress.ratio} color={accentColor} />
        ) : (
          <div className="h-10 w-10 rounded-lg grid place-items-center shrink-0" style={{ backgroundColor: bgTint }}>
            <Icon className="h-5 w-5" style={{ color: accentColor }} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-primary">{goal.title}</div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${kindBadgeColors[goal.kind]}`}>
                {(g[`kind${goal.kind.charAt(0).toUpperCase() + goal.kind.slice(1)}` as keyof typeof g] as string | undefined) ?? goal.kind}
              </span>
              <span className="text-[9px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded">
                {goal.tracking === "category"
                  ? (goal.autoTrackMode === "always" ? "Always" : goal.autoTrackMode === "selected" ? "Selected" : goal.autoTrackMode === "commitments" ? "Commitments" : "Auto")
                  : goal.tracking === "goalBlock" ? "Check-ins" : goal.tracking === "quota" ? "Duration" : goal.tracking === "subTask" ? "Subtasks" : goal.tracking === "none" ? "Milestone" : goal.tracking}
              </span>
            </div>
          </div>
          {goal.description && (
            <div className="text-xs text-muted-foreground mt-1">{goal.description}</div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="num text-xs text-primary font-medium">
              {progress.denominator === 0 ? (
                <span className="text-muted-foreground">--</span>
              ) : goal.kind === "duration" ? (
                <>{fmtDur(progress.numerator)}<span className="text-muted-foreground"> / </span>{fmtDur(progress.denominator)}</>
              ) : (
                <>{progress.numerator}<span className="text-muted-foreground"> / </span>{progress.denominator}</>
              )}
              {goal.unit ? <span className="text-muted-foreground ml-1">{goal.unit}</span> : null}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">{periodLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          {goal.kind === "numeric" ? (
            <SegmentedProgress numerator={progress.numerator} denominator={progress.denominator} color={accentColor} />
          ) : (
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: accentColor }} />
            </div>
          )}
        </div>
        {goal.period !== "total" && (
          <div className="flex items-center gap-1 text-[10px] text-orange-500/80 font-medium shrink-0">
            <Flame className="h-3 w-3" />
            <span>{computeStreak(goal, todayIso)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {progress.ratio >= 1 && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {goal.kind === "deadline" && goal.tracking === "none" ? "Reached" : "Complete"}
          </div>
        )}
        {goal.kind === "deadline" && goal.deadline && (() => {
          const d = daysUntilDeadline(goal.deadline);
          const overdue = d < 0;
          return (
            <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${overdue ? "bg-rose-500/15 text-rose-600" : d === 0 ? "bg-rose-500/15 text-rose-600" : d <= 3 ? "bg-amber-500/15 text-amber-600" : "bg-muted/50 text-muted-foreground"}`}>
              <CalendarDays className="h-3 w-3" />
              <span>{overdue ? `${Math.abs(d)} days overdue` : d === 0 ? "Due today" : d === 1 ? "1 day left" : `${d} days left`}</span>
            </div>
          );
        })()}
      </div>

      <div className="flex items-center gap-1.5">
        {goal.tracking === "goalBlock" && onAddBlock && (
          <button onClick={() => onAddBlock(goal.id)}
            className="flex items-center gap-1 rounded-md border border-dashed border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-primary hover:border-secondary/40 transition-colors"
          >
            <Plus className="h-3 w-3" />
            {g.checkIn}
          </button>
        )}
        {goal.tracking === "quota" && onAddBlock && (
          <div className="flex items-center gap-1 rounded-md border border-dashed border-border/60 px-2 py-1.5">
            <button onClick={() => onAddBlock(goal.id, blockDuration)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              {g.checkIn}
            </button>
            <span className="text-muted-foreground/30">|</span>
            <input type="number" min={15} max={480} step={15} value={blockDuration}
              onChange={(e) => setBlockDuration(Number(e.target.value) || 60)}
              className="w-14 text-[10px] text-center text-muted-foreground bg-transparent border-0 p-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[9px] text-muted-foreground">min</span>
          </div>
        )}
        {goal.autoTrackMode === "selected" && onAssignMode && (
          <button onClick={() => onAssignMode(goal.id)}
            className="rounded-md border border-border/60 px-2 py-1.5 text-xs text-muted-foreground hover:text-secondary hover:border-secondary/40 transition-colors"
          >
            <Target className="h-3 w-3 inline mr-1" />
            Assign
          </button>
        )}
        <button onClick={() => onEdit(goal)} className="rounded-md border border-border/60 px-2 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors">
          <Pencil className="h-3 w-3" />
        </button>
        <button onClick={() => onRemove(goal.id)} className="rounded-md border border-border/60 px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {ongoingBlocks.length > 0 && (
        <div className="rounded-lg bg-muted/30 border border-border/40 p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{t.chronos.today.eyebrow}</div>
          {ongoingBlocks.map((b) => (
            <button key={b.id} onClick={() => onToggleBlock(goal.id, b.id)}
              className="flex items-center gap-2 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-muted/50"
            >
              <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate text-primary">{b.title || goal.title}</span>
              <span className="text-[10px] num text-muted-foreground">{fmtDur(b.duration)}</span>
            </button>
          ))}
        </div>
      )}

      {doneBlocks.length > 0 && (
        <div className="border-t border-border/30 pt-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.done}</div>
          {doneBlocks.map((b) => (
            <button key={b.id} onClick={() => onToggleBlock(goal.id, b.id)}
              className="flex items-center gap-2 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-muted/50"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-muted-foreground">{b.title || goal.title}</div>
                <div className="text-[10px] text-muted-foreground/60">{b.date}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {goal.autoTrackMode === "commitments" && commitments && goal.looseCommitmentIds.length > 0 && (
        <div className="border-t border-border/30 pt-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Commitments</div>
          {goal.looseCommitmentIds.map((cid) => {
            const cmt = commitments.find((c) => c.id === cid);
            const isDone = cmt && cmt.date && new Date(cmt.date + "T" + (cmt.end || "23:59")) <= new Date();
            return (
              <div key={cid} className="flex items-center gap-2 text-xs py-0.5 px-1.5">
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className={`flex-1 truncate ${isDone ? "line-through text-muted-foreground" : "text-primary"}`}>
                  {cmt?.title ?? cid}
                </span>
                {cmt?.date && <span className="text-[10px] text-muted-foreground">{cmt.date}</span>}
              </div>
            );
          })}
        </div>
      )}
      {!compact && goal.tracking === "subTask" && (
        <div className="pt-1 border-t border-border/30">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{g.subTasks(goal.subTasks.length)}</div>
            {onAddSubTask && (
              <form onSubmit={(e) => { e.preventDefault(); if (newSubTask.trim()) { onAddSubTask(goal.id, newSubTask.trim()); setNewSubTask(""); } }}
                className="flex items-center gap-1"
              >
                <input value={newSubTask} onChange={(e) => setNewSubTask(e.target.value)}
                  placeholder="Add..."
                  className="h-6 w-28 rounded border border-border/60 bg-muted/30 px-1.5 text-[10px] outline-none focus:border-secondary/50"
                />
                <button type="submit" disabled={!newSubTask.trim()}
                  className="h-6 w-6 rounded bg-secondary/10 text-secondary grid place-items-center text-xs font-medium disabled:opacity-30"
                >+</button>
              </form>
            )}
          </div>
          {goal.subTasks.length > 0 && goal.subTasks.map((st) => (
            <button key={st.id} onClick={() => onToggleSubTask(goal.id, st.id)}
              className="flex items-center gap-2 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-muted/50"
            >
              <Square className={`h-3 w-3 shrink-0 ${st.done ? "text-secondary" : "text-muted-foreground"}`} />
              <span className={`flex-1 truncate ${st.done ? "line-through text-muted-foreground" : "text-primary"}`}>{st.title}</span>
            </button>
          ))}
        </div>
      )}
      {!compact && snapshots && snapshots.length > 0 && (
        <div className="pt-2 border-t border-border/30 flex items-center gap-2">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <ProgressChart goal={goal} snapshots={snapshots} />
        </div>
      )}
    </div>
  );
}
