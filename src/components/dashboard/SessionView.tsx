import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import type { WorkspaceStructure, WorkspaceRuntime, TreeNode, LevelDef } from "@/lib/schedule/types";
import { selectTemplate, calcProgress, getTrackingLeaves, toggleTracking, setTracking, resolveActiveTemplateName, getNextUndonePath, initRuntime } from "@/lib/schedule/workspace-engine";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useT, useI18n } from "@/lib/i18n/I18nProvider";
import { useTimer } from "@/lib/timer/TimerContext";
import { Clock, Trophy, ChevronDown, ChevronRight, Play, CheckCircle2 } from "lucide-react";

type SessionState = "preview" | "active" | "completed";

function detectState(structure: WorkspaceStructure, runtime: WorkspaceRuntime): SessionState {
  const r = runtime as Record<string, unknown>;
  const { done, total } = calcProgress(runtime, structure);
  if (r._sessionStarted) {
    if (total > 0 && done >= total) return "completed";
    return "active";
  }
  if (total === 0) return "preview";
  if (done >= total) return "completed";
  if (done > 0) return "active";
  return "preview";
}

function fmtElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type DisplaySet = {
  key: string;
  label: string;
  value: boolean | number;
  path: string[];
  fields: Record<string, unknown>;
};

type DisplayExercise = {
  groupName: string;
  groupLabel: string;
  exerciseName: string;
  exerciseFields: Record<string, unknown>;
  sets: DisplaySet[];
  doneCount: number;
  totalCount: number;
};

function buildDisplayItems(structure: WorkspaceStructure, runtime: WorkspaceRuntime): DisplayExercise[] {
  const r = runtime as Record<string, unknown>;
  const tplName = resolveActiveTemplateName(runtime);
  const tpl = selectTemplate(structure, tplName);
  if (!tpl || !tpl.children) return [];

  const trackingLevel = structure.levels.find((l) => l.tracking);
  if (!trackingLevel) return [];

  const trackingDepth = structure.levels.indexOf(trackingLevel);
  const tr = (r.tracking ?? {}) as Record<string, boolean | number>;

  return tpl.children.flatMap((group) => {
    if (!group.children) return [];
    return group.children.map((exercise) => {
      if (!exercise.children) return { groupName: group.name, groupLabel: "", exerciseName: exercise.name, exerciseFields: exercise.fields ?? {}, sets: [], doneCount: 0, totalCount: 0 };
      const sets = exercise.children.map((set, i) => {
        const path = [group.name, exercise.name, set.name];
        const key = path.join("/");
        return {
          key,
          label: set.fields?.instruction as string || `${structure.levels[2]?.label ?? "Set"} ${i + 1}`,
          value: tr[key] ?? (trackingLevel.tracking!.default as boolean | number),
          path,
          fields: set.fields ?? {},
        };
      });
      const doneCount = sets.filter((s) => s.value === true || (typeof s.value === "number" && s.value > 0)).length;
      return { groupName: group.name, groupLabel: "", exerciseName: exercise.name, exerciseFields: exercise.fields ?? {}, sets, doneCount, totalCount: sets.length };
    });
  });
}

function useTimer(startedAt: number | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (startedAt == null) return;
    setElapsed(Date.now() - startedAt);
    const id = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

function PreviewView({
  structure,
  runtime,
  onStart,
}: {
  structure: WorkspaceStructure;
  runtime: WorkspaceRuntime;
  onStart: () => void;
}) {
  const tplName = resolveActiveTemplateName(runtime) ?? structure.templates[0]?.name;
  const tpl = selectTemplate(structure, tplName);
  const { total } = calcProgress(runtime, structure);
  const displayItems = buildDisplayItems(structure, runtime);
  const groups = new Map<string, DisplayExercise[]>();
  for (const item of displayItems) {
    if (!groups.has(item.groupName)) groups.set(item.groupName, []);
    groups.get(item.groupName)!.push(item);
  }
  const itemLabel = structure.levels[1]?.labelPlural ?? "items";

  if (!tpl) return <p className="text-sm text-muted-foreground py-4 text-center">No session template</p>;

  return (
    <div className="space-y-4 min-w-0">
      <div className="text-center space-y-1">
        <p className="text-base font-medium text-primary">{tpl.name}</p>
        {tpl.children && (
          <p className="text-xs text-muted-foreground">
            {tpl.children.reduce((s, g) => s + (g.children?.length || 0), 0)} {itemLabel.toLowerCase()} · {total} total
          </p>
        )}
      </div>
      <div className="space-y-1 min-w-0">
        {Array.from(groups.entries()).map(([groupName, items]) => (
          <div key={groupName}>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-0.5 py-0.5">{groupName}</p>
            {items.map((item) => (
              <div key={item.exerciseName} className="flex items-center gap-1.5 px-1 py-0.5 min-w-0">
                <span className="text-[11px] text-secondary truncate min-w-0 flex-1">{item.exerciseName}</span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">
                  {item.totalCount > 0 && `${item.totalCount} ${structure.levels[2]?.labelPlural?.toLowerCase() ?? "sets"}`}
                  {item.sets[0]?.fields?.instruction && ` · ${item.sets[0].fields.instruction}`}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Button onClick={onStart} className="w-full gap-2">
        <Play className="h-4 w-4" /> Start Session
      </Button>
    </div>
  );
}

function ActiveView({
  structure,
  runtime,
  onChange,
  onEnd,
}: {
  structure: WorkspaceStructure;
  runtime: WorkspaceRuntime;
  onChange: (runtime: WorkspaceRuntime) => void;
  onEnd: () => void;
}) {
  const tplName = resolveActiveTemplateName(runtime);
  const nextPath = getNextUndonePath(structure, runtime);
  const { done, total } = calcProgress(runtime, structure);
  const trackingLevel = structure.levels.find((l) => l.tracking);
  const displayItems = buildDisplayItems(structure, runtime);
  const groups = new Map<string, DisplayExercise[]>();
  for (const item of displayItems) {
    if (!groups.has(item.groupName)) groups.set(item.groupName, []);
    groups.get(item.groupName)!.push(item);
  }
  const itemLabel = structure.levels[1]?.label ?? "item";
  const itemLabelPlural = structure.levels[1]?.labelPlural ?? "items";

  const r = runtime as Record<string, unknown>;
  const startedAt = (r._sessionStartedAt as number) ?? null;
  const elapsed = useTimer(startedAt);

  const currentExercise = nextPath
    ? displayItems.find((item) => item.sets.some((s) => s.key === nextPath.join("/")))
    : null;
  const currentSet = nextPath
    ? displayItems.flatMap((i) => i.sets).find((s) => s.key === nextPath.join("/"))
    : null;

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [justCompleted, setJustCompleted] = useState(false);
  const justCompletedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleExercise = (name: string) => {
    setExpandedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  function handleToggle(key: string) {
    onChange(toggleTracking(runtime, key));
    setJustCompleted(true);
    if (justCompletedTimer.current) clearTimeout(justCompletedTimer.current);
    justCompletedTimer.current = setTimeout(() => setJustCompleted(false), 400);
  }

  function handleSetNumber(key: string, value: number) {
    onChange(setTracking(runtime, key, value));
  }

  const isNumberTracking = trackingLevel?.tracking?.type === "number";
  const progress = total > 0 ? (done / total) * 100 : 0;

  const nextItemVerb = currentSet?.fields?.instruction
    ? `${currentExercise?.exerciseName} · ${currentSet.label}`
    : nextPath?.slice(-2).join(" · ") ?? "";

  const displayNextItem = nextPath && currentSet ? (
    currentSet.fields?.instruction
      ? `${currentExercise?.exerciseName} · ${currentSet.label}`
      : `${currentExercise?.exerciseName} · ${structure.levels[2]?.label ?? "Set"} ${nextPath[nextPath.length - 1]?.replace("Set ", "")}`
  ) : "";

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between border-b border-border/10 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-primary min-w-0 truncate">{tplName}</p>
          {startedAt && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground/70 num shrink-0">
              <Clock className="h-3 w-3" />
              {fmtElapsed(elapsed)}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground num shrink-0 ml-2">{done}/{total}</span>
      </div>

      {justCompleted && (
        <div className="text-center py-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
            <CheckCircle2 className="h-5 w-5" /> Completed!
          </span>
        </div>
      )}

      {currentSet && (
        <div className="rounded-xl border border-primary/25 bg-gradient-to-b from-primary/8 to-primary/3 p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              {structure.levels[2]?.label ?? "Set"} to track
            </span>
            <span className="text-[10px] text-muted-foreground/60 num">
              {done}/{total} {itemLabelPlural.toLowerCase()}
            </span>
          </div>

          {currentExercise && (
            <p className="text-sm text-muted-foreground">
              {currentExercise.groupName} ·{" "}
              <span className="text-primary font-medium">{currentExercise.exerciseName}</span>
            </p>
          )}

          <p className="text-lg font-semibold text-primary">
            {currentSet.label}
          </p>

          {Object.entries(currentSet.fields).filter(([k]) => k !== "instruction").length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(currentSet.fields)
                .filter(([k]) => k !== "instruction")
                .map(([k, v]) => (
                  <span key={k} className="rounded-md bg-muted/30 border border-border/20 px-2 py-0.5 text-xs text-muted-foreground num">
                    {structure.levels[2]?.fields.find((f) => f.name === k)?.label ?? k}: {String(v)}
                  </span>
                ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {isNumberTracking ? (
              <div className="flex items-center gap-2 w-full">
                <Input
                  type="number"
                  min={0}
                  value={Number(currentSet.value) || 0}
                  onChange={(e) => handleSetNumber(currentSet.key, Number(e.target.value) || 0)}
                  className="h-10 w-full text-base"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => handleSetNumber(currentSet.key, 0)}
                  variant="outline"
                  className="shrink-0 h-10"
                >
                  Skip
                </Button>
              </div>
            ) : (
              <Button
                size="lg"
                onClick={() => handleToggle(currentSet.key)}
                className="flex-1 text-base h-12 gap-2"
              >
                <CheckCircle2 className="h-5 w-5" /> Complete
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {displayNextItem && (
          <p className="text-[10px] text-muted-foreground/50 truncate px-0.5">
            Next: {displayNextItem}
          </p>
        )}
      </div>

      <div className="space-y-0.5 max-h-[280px] overflow-y-auto border-t border-border/10 pt-2 min-w-0">
        {Array.from(groups.entries()).map(([groupName, items]) => {
          const groupDone = items.every((i) => i.doneCount === i.totalCount);
          const groupTotal = items.reduce((s, i) => s + i.totalCount, 0);
          const groupDoneTotal = items.reduce((s, i) => s + i.doneCount, 0);
          const collapsed = collapsedGroups.has(groupName);
          return (
            <div key={groupName} className="space-y-0.5">
              <button
                onClick={() => toggleGroup(groupName)}
                className="flex items-center gap-2 w-full text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 py-1 hover:bg-muted/10 rounded transition-colors"
              >
                {collapsed ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${groupDone ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                <span className="truncate">{groupName}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/60 num shrink-0">{groupDoneTotal}/{groupTotal}</span>
              </button>
              {!collapsed && items.map((item) => {
                const isCurrentExercise = currentExercise?.exerciseName === item.exerciseName;
                const isExpanded = expandedExercises.has(item.exerciseName);
                return (
                  <div key={item.exerciseName} className="pl-4 space-y-0 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleExercise(item.exerciseName)}
                      className={`flex items-center gap-2 w-full px-2 py-1 text-[10px] rounded text-left transition-colors hover:bg-muted/10 ${
                        isCurrentExercise ? "bg-primary/5 text-primary font-medium" : "text-secondary/80"
                      }`}
                    >
                      {item.doneCount === item.totalCount && item.totalCount > 0 ? (
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      ) : (
                        <span className="h-3 w-3 rounded-full border border-muted-foreground/30 shrink-0" />
                      )}
                      <span className="truncate flex-1 min-w-0">{item.exerciseName}</span>
                      <span className="text-[10px] text-muted-foreground/60 num shrink-0">{item.doneCount}/{item.totalCount}</span>
                      {item.totalCount > 0 && (
                        isExpanded
                          ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                          : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                      )}
                    </button>

                    {isExpanded && item.sets.map((set) => {
                      const isDone = set.value === true || (typeof set.value === "number" && set.value > 0);
                      const isCurrent = set.key === currentSet?.key;
                      return (
                        <button
                          key={set.key}
                          type="button"
                          onClick={() => handleToggle(set.key)}
                          className={`flex items-center gap-2 w-full px-3 py-0.5 text-[10px] rounded text-left transition-colors hover:bg-muted/10 ${
                            isCurrent ? "text-secondary font-medium" : isDone ? "text-muted-foreground/50 line-through" : "text-muted-foreground/70"
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full shrink-0 border transition-colors ${
                            isDone ? "bg-green-500 border-green-500" : isCurrent ? "border-secondary" : "border-muted-foreground/30"
                          }`} />
                          <span className="truncate">{set.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <Button variant="outline" size="sm" onClick={onEnd} className="w-full text-xs text-muted-foreground">
        End Session
      </Button>
    </div>
  );
}

function CompletedView({
  structure,
  runtime,
  onDone,
}: {
  structure: WorkspaceStructure;
  runtime: WorkspaceRuntime;
  onDone: () => void;
}) {
  const tplName = resolveActiveTemplateName(runtime);
  const { done, total } = calcProgress(runtime, structure);
  const displayItems = buildDisplayItems(structure, runtime);
  const groups = new Map<string, DisplayExercise[]>();
  for (const item of displayItems) {
    if (!groups.has(item.groupName)) groups.set(item.groupName, []);
    groups.get(item.groupName)!.push(item);
  }
  const r = runtime as Record<string, unknown>;
  const startedAt = (r._sessionStartedAt as number) ?? null;
  const elapsed = useTimer(startedAt);
  const itemLabelPlural = structure.levels[1]?.labelPlural?.toLowerCase() ?? "items";

  return (
    <div className="space-y-5 text-center min-w-0">
      <div className="space-y-2 pt-2">
        <div className="inline-flex h-14 w-14 rounded-full bg-green-500/15 items-center justify-center mx-auto">
          <Trophy className="h-7 w-7 text-green-500" />
        </div>
        <p className="text-xl font-semibold text-primary">{tplName}</p>
        <p className="text-sm text-green-600 dark:text-green-400 font-medium">Session complete</p>
        <p className="text-xs text-muted-foreground">
          {done}/{total} {itemLabelPlural} {startedAt && `· ${fmtElapsed(elapsed)}`}
        </p>
      </div>

      <div className="h-2 rounded-full bg-muted/20 overflow-hidden">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
        />
      </div>

      <div className="max-h-60 overflow-y-auto text-left space-y-1">
        {Array.from(groups.entries()).map(([groupName, items]) => (
          <div key={groupName}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 py-0.5">
              {groupName}
            </p>
            {items.map((item) => (
              <div key={item.exerciseName} className="flex items-center gap-2 px-3 py-1 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-secondary">{item.exerciseName}</span>
                {item.sets[0]?.label && (
                  <span className="text-xs text-muted-foreground/60 ml-auto">{item.sets[0].label}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Button onClick={onDone} className="w-full gap-2">
        <CheckCircle2 className="h-4 w-4" /> Done
      </Button>
    </div>
  );
}

export function SessionView({
  structure,
  runtime,
  onChange,
  onClose,
}: {
  structure: WorkspaceStructure;
  runtime: WorkspaceRuntime;
  onChange: (runtime: WorkspaceRuntime) => void;
  onClose: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const state = detectState(structure, runtime);
  const timer = useTimer();

  useEffect(() => {
    if (starting && state === "active") setStarting(false);
  }, [state, starting]);

  function handleStart() {
    setStarting(true);
    const tplName = resolveActiveTemplateName(runtime) ?? structure.templates[0]?.name ?? "";
    const r = runtime as Record<string, unknown>;
    const hasTracking = r.tracking && Object.keys(r.tracking as Record<string, unknown>).length > 0;
    const base = hasTracking ? runtime : initRuntime(structure, tplName);
    const newRuntime = {
      ...(base as Record<string, unknown>),
      templateName: tplName,
      _sessionStarted: true,
      _sessionStartedAt: Date.now(),
    } as WorkspaceRuntime;
    onChange(newRuntime);

    if (timer?.start && !timer?.running) {
      const { total } = calcProgress(newRuntime, structure);
      const estimatedMin = Math.max(15, total * 2);
      timer.start(estimatedMin);
    }
  }

  function handleEnd() {
    onChange({
      ...(runtime as Record<string, unknown>),
      _sessionEnded: true,
    } as WorkspaceRuntime);
  }

  if (starting || state === "active") {
    return <ActiveView structure={structure} runtime={runtime} onChange={onChange} onEnd={handleEnd} />;
  }

  if (state === "completed") {
    return <CompletedView structure={structure} runtime={runtime} onDone={onClose} />;
  }

  return <PreviewView structure={structure} runtime={runtime} onStart={handleStart} />;
}

export function BlockSessionBadge({
  structure,
  runtime,
  tier = "full",
}: {
  structure: WorkspaceStructure;
  runtime: WorkspaceRuntime;
  tier?: "micro" | "compact" | "hour" | "full";
}) {
  const tplName = resolveActiveTemplateName(runtime) ?? structure.templates[0]?.name;
  if (!tplName) return null;

  const { done, total } = calcProgress(runtime, structure);
  const state = detectState(structure, runtime);

  const dotColor =
    state === "completed" ? "bg-green-500" :
    state === "active"    ? "bg-secondary" :
                            "bg-muted-foreground/25";

  const showCount = total > 0 && (state === "active" || state === "completed");

  if (tier === "micro") {
    return (
      <span className="inline-flex items-center gap-1 leading-none">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-[9px] font-medium text-primary/70 truncate max-w-[4rem]">{tplName}</span>
      </span>
    );
  }

  if (tier === "compact") {
    return (
      <span className="inline-flex items-center gap-1 leading-none">
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-[9px] font-medium text-primary/70 truncate max-w-[5rem]">{tplName}</span>
        {showCount && (
          <span className="text-[9px] text-muted-foreground/50 num">{done}/{total}</span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-muted/30 px-1.5 py-0.5 leading-none min-w-0">
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span className="text-[10px] font-medium text-primary/80 truncate max-w-[6rem]">{tplName}</span>
      {showCount && (
        <span className="text-[10px] text-muted-foreground/50 num ml-auto shrink-0">
          {state === "completed" ? "✓" : `${done}/${total}`}
        </span>
      )}
    </span>
  );
}
