# Auto-Track Expansion Plan

## Data Model (`types.ts`)

### Goal interface — add two fields after `color?`:

```typescript
autoTrackMode?: "always" | "selected" | "commitments";
trackedBlockKeys?: string[];
```

### computeGoalProgress — accept routine/commitment arrays, branch on autoTrackMode

```typescript
export function computeGoalProgress(
  g: Goal,
  today?: string,
  allGoals?: Goal[],
  routine?: RoutineBlock[],
  commitments?: Commitment[]
): GoalProgress {
```

Replace the `case "category"` block with mode-aware logic:

```typescript
case "category": {
  denominator = g.target;
  const targetCat = g.categoryId;
  if (!targetCat) break;
  const mode = g.autoTrackMode ?? "always";
  const period = getPeriodStartEnd(g.startDate, g.period, todayIso);

  if (mode === "commitments") {
    // Count only commitments linked via looseCommitmentIds
    const linked = (commitments ?? []).filter((c) =>
      g.looseCommitmentIds.includes(c.id) &&
      c.date && c.date >= period.start && c.date <= period.end
    );
    // A commitment is "done" if its end time has passed
    const now = new Date();
    const done = linked.filter((c) => {
      if (!c.date) return false;
      const endDateTime = new Date(c.date + "T" + (c.end || "23:59"));
      return endDateTime <= now;
    });
    numerator = Math.min(done.length, denominator);
    break;
  }

  if (mode === "selected") {
    // Only count blocks whose keys are in trackedBlockKeys
    const blockKeys = g.trackedBlockKeys ?? [];
    // Count tracked routine blocks
    const routineCount = (routine ?? []).filter((r) =>
      r.kind === targetCat && blockKeys.includes("routine-" + r.id)
    ).length;
    // Count tracked commitment blocks
    const commitmentCount = (commitments ?? []).filter((c) =>
      c.kind === targetCat && blockKeys.includes("commitment-" + c.id)
    ).length;
    // Count tracked GoalBlocks (across all goals with same category)
    const relevant = allGoals
      ? allGoals.filter((og) => og.categoryId === targetCat).flatMap((og) => og.blocks)
      : g.blocks;
    const goalBlockCount = relevant.filter((b) =>
      b.done && b.date >= period.start && b.date <= period.end &&
      blockKeys.includes("goalblock-" + b.id)
    ).length;
    numerator = g.kind === "duration"
      ? (routineCount * 60 + commitmentCount * 60 + goalBlockCount) // approximate duration
      : routineCount + commitmentCount + goalBlockCount;
    break;
  }

  // mode === "always": count all matching blocks
  // Count routine blocks matching the category within the period
  let count = 0;
  const periodStart = new Date(period.start + "T00:00:00");
  const periodEnd = new Date(period.end + "T23:59:59");
  for (const r of routine ?? []) {
    if (r.kind !== targetCat) continue;
    // Count this routine for each day in the period that matches its day-of-week
    let d = new Date(periodStart);
    while (d <= periodEnd) {
      if (d.getDay() === r.day) count++;
      d.setDate(d.getDate() + 1);
    }
  }
  // Count commitment blocks with date in period
  for (const c of commitments ?? []) {
    if (c.kind !== targetCat) continue;
    if (c.date && c.date >= period.start && c.date <= period.end) count++;
  }
  // Count GoalBlocks from all goals with same category
  const relevant = allGoals
    ? allGoals.filter((og) => og.categoryId === targetCat).flatMap((og) => og.blocks)
    : g.blocks;
  const goalBlockCount = relevant.filter((b) =>
    b.done && b.date >= period.start && b.date <= period.end
  ).length;
  count += goalBlockCount;

  numerator = g.kind === "duration"
    ? count * 60 // approximate — sum actual durations later
    : count;
  break;
}
```

**Important note on "always" mode duration**: For proper duration summing in "always" mode, sum actual `durationMin` of each block's interval rather than using count * 60. For routine blocks, compute `durationMin(r.start, r.end)`. For commitments, same. For GoalBlocks, use `b.duration`.

---

## Store Functions (`store.tsx`)

### generateGoalCommitments

```typescript
const generateGoalCommitments = useCallback((goalId: string) => {
  const goal = data.goals.find((g) => g.id === goalId);
  if (!goal || goal.autoTrackMode !== "commitments") return;
  const N = goal.target;
  const newIds: string[] = [];
  for (let i = 0; i < N; i++) {
    const id = uid("cmt");
    newIds.push(id);
  }
  setData((d) =>
    withDerived({
      ...d,
      commitments: [
        ...d.commitments,
        ...newIds.map((id) => ({
          id,
          date: undefined as string | undefined,
          start: "00:00",
          end: "01:00",
          kind: goal.categoryId ?? "custom",
          title: `${goal.title} ${newIds.indexOf(id) + 1}/${N}`,
        })),
      ],
      goals: d.goals.map((g) =>
        g.id === goalId
          ? { ...g, looseCommitmentIds: [...g.looseCommitmentIds, ...newIds] }
          : g
      ),
    })
  );
}, [data]);
```

### trackBlockForGoal

```typescript
const trackBlockForGoal = useCallback((goalId: string, blockKey: string) => {
  setData((d) =>
    withDerived({
      ...d,
      goals: d.goals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              trackedBlockKeys: g.trackedBlockKeys?.includes(blockKey)
                ? g.trackedBlockKeys.filter((k) => k !== blockKey)
                : [...(g.trackedBlockKeys ?? []), blockKey],
            }
          : g
      ),
    })
  );
}, []);
```

### isBlockTrackedForAnyGoal

```typescript
const isBlockTrackedForAnyGoal = useCallback((blockKey: string): boolean => {
  return data.goals.some((g) => g.trackedBlockKeys?.includes(blockKey));
}, [data]);
```

### recomputeOverallGoalProgress

Same branching as `computeGoalProgress` — replicate the `autoTrackMode` logic inside the `case "category"` block. Also needs `routine` and `commitments` passed in from the schedule data.

---

## GoalDialog.tsx — autoTrackMode selector

When `tracking === "category"`, show a 3-card row:

```tsx
const autoMeta = [
  { value: "always" as const, icon: RefreshCw, label: "Always", desc: "Auto-count all matching blocks" },
  { value: "selected" as const, icon: CheckSquare, label: "Selected", desc: "Pick which blocks count" },
  { value: "commitments" as const, icon: ListTodo, label: "Commitments", desc: "Generate N commitment slots" },
];
```

Add below the category picker:

```tsx
<div className="space-y-1.5">
  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Auto-track mode</Label>
  <div className="grid grid-cols-3 gap-1">
    {autoMeta.map((opt) => {
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
```

On save, include `autoTrackMode`. If `mode === "commitments"`, call `generateGoalCommitments` from the store.

---

## GoalCard.tsx — Selected + Commitments mode

### New props

```typescript
allGoals?: Goal[];
onTrackBlock?: (goalId: string, blockKey: string) => void;
onGenerateCommitments?: (goalId: string) => void;
```

### For `selected` mode:
Add an "Assign blocks" button in the action row:

```tsx
{goal.autoTrackMode === "selected" && (
  <button onClick={() => onAssignMode?.(goal.id)}
    className="rounded-md border border-secondary/40 px-2 py-1.5 text-xs text-secondary hover:bg-secondary/10 transition-colors"
  >
    <Target className="h-3 w-3 inline mr-1" />
    Assign blocks
  </button>
)}
```

### For `commitments` mode:
Show a checklist of linked commitments:

```tsx
{goal.autoTrackMode === "commitments" && goal.looseCommitmentIds.length > 0 && (
  <div className="border-t border-border/30 pt-2 space-y-1">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Commitments</div>
    {goal.looseCommitmentIds.map((cid) => {
      const cmt = commitments?.find((c) => c.id === cid);
      const isDone = cmt && cmt.date && new Date(cmt.date + "T" + (cmt.end || "23:59")) <= new Date();
      return (
        <div key={cid} className="flex items-center gap-2 text-xs py-1 px-1.5">
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
```

---

## BlockDetailsDialog.tsx — Tracked goals section

Find the existing block details dialog. Add at the bottom (before the action buttons):

```tsx
{/* Tracked goals */}
{(() => {
  const matchingGoals = goals.filter(
    (g) =>
      g.categoryId === item.kind &&
      g.autoTrackMode &&
      g.autoTrackMode !== "always"
  );
  if (matchingGoals.length === 0) return null;
  return (
    <div className="border-t border-border/30 pt-3 mt-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tracked to goals</div>
      {matchingGoals.map((g) => {
        const blockKey = item.source + "-" + (item.sourceId ?? item.id);
        const isTracked = g.trackedBlockKeys?.includes(blockKey);
        return (
          <button key={g.id}
            onClick={() => onTrackBlockForGoal?.(g.id, blockKey)}
            className="flex items-center gap-2 w-full text-left text-xs py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
          >
            {isTracked ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="truncate text-primary font-medium">{g.title}</div>
              <div className="text-[10px] text-muted-foreground">{g.autoTrackMode}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
})()}
```

---

## DayPlanner.tsx — Assign mode + indicators

### State

```typescript
const [assignGoalId, setAssignGoalId] = useState<string | null>(null);
```

### Assign mode banner (below the timeline header)

```tsx
{assignGoalId && (() => {
  const ag = data.goals.find((g) => g.id === assignGoalId);
  if (!ag) return null;
  return (
    <div className="flex items-center justify-between bg-secondary/10 border border-secondary/30 rounded-lg px-4 py-2 mb-3">
      <span className="text-xs text-primary font-medium">
        Assigning blocks to <span className="text-secondary">{ag.title}</span>
      </span>
      <button onClick={() => setAssignGoalId(null)}
        className="text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded hover:bg-muted/50 transition-colors"
      >
        Exit
      </button>
    </div>
  );
})()}
```

### Block overlay click handler

When rendering agenda items, if `assignGoalId` is set and the block's kind matches the goal's category:

```tsx
{assignGoalId && (() => {
  const ag = data.goals.find((g) => g.id === assignGoalId);
  if (!ag || ag.categoryId !== a.kind) return null;
  const blockKey = a.source + "-" + (a.sourceId ?? a.id);
  const isAssigned = ag.trackedBlockKeys?.includes(blockKey);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onTrackBlockForGoal(assignGoalId, blockKey); }}
      className="absolute right-1 top-1 h-5 w-5 rounded grid place-items-center transition-colors z-10"
      style={{ backgroundColor: isAssigned ? "hsl(var(--secondary))" : "hsl(var(--muted))" }}
    >
      {isAssigned ? (
        <Check className="h-3 w-3 text-white" />
      ) : (
        <Plus className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
})()}
```

### Tracked indicator

For non-assign-mode, show a small dot on blocks tracked by any goal:

```tsx
{isBlockTrackedForAnyGoal?.(blockKey) && (
  <div className="absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full bg-secondary" />
)}
```

### Hover shortcut for selected mode

On block hover, show a small "+" if the block has a matching goal with `autoTrackMode === "selected"` and isn't tracked yet.

---

## Today.tsx / Week.tsx — Thread assign mode state

Pass `assignGoalId` state down. Add:

```tsx
const [assignGoalId, setAssignGoalId] = useState<string | null>(null);
```

Pass to `GoalSection`:

```tsx
<GoalSection
  ...
  assignGoalId={assignGoalId}
  onAssignMode={setAssignGoalId}
  onTrackBlockForGoal={trackBlockForGoal}
/>
```

And to `DayPlanner`:

```tsx
<DayPlanner
  ...
  assignGoalId={assignGoalId}
  onAssignMode={setAssignGoalId}
  onTrackBlockForGoal={trackBlockForGoal}
  isBlockTrackedForAnyGoal={isBlockTrackedForAnyGoal}
/>
```

---

## Sort Priority

1. `types.ts` — Goal fields + `computeGoalProgress` update
2. `store.tsx` — new store functions + `recomputeOverallGoalProgress` update
3. `GoalDialog.tsx` — autoTrackMode selector
4. `GoalCard.tsx` — assign button + commitments checklist
5. `BlockDetailsDialog.tsx` — tracked goals toggle
6. `DayPlanner.tsx` — assign mode overlay + tracked indicators
7. `Today.tsx` + `Week.tsx` — wire everything together
8. Build + test
