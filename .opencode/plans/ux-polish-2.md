# UX Polish Round 2 — Implementation Plan

## Fix A: Duration input — remove "for" preposition

**File:** `src/components/dashboard/GoalCard.tsx`

Remove line 140 (`<span className="text-[9px] text-muted-foreground">for</span>`).

Before:
```
[+ Check-in] | for [60] min
```
After:
```
[+ Check-in] | [60] min
```

Just the number `w-14 text-center` immediately after `|`, then `min`.

---

## Fix B: Activity-based Today filtering

**File:** `src/lib/schedule/store.tsx` — `getGoalsForDate` (line 1038)

Current: period-only check. Replace with:

```
if (g.startDate > date) return false;
if (g.deadline && g.deadline < date) return false;
const period = getPeriodStartEnd(g.startDate, g.period, date);
if (!(date >= period.start && date <= period.end)) return false;
// Manual-tracking goals always show (user can check in)
if (g.tracking !== "category") return true;
if (g.autoTrackMode === "always") return true;
// Selected mode: check day-of-week for routines, date match for commitments/blocks
if (g.autoTrackMode === "selected" && g.trackedBlockKeys?.length) {
  const dayOfWeek = new Date(date + "T00:00:00").getDay();
  if (g.trackedBlockKeys.some(k => {
    if (k.startsWith("routine-")) return data.routine.some(r => r.id === k.slice(8) && r.days.includes(dayOfWeek));
    if (k.startsWith("commitment-")) return data.commitments.some(c => c.id === k.slice(11) && c.date === date);
    if (k.startsWith("goalblock-")) return g.blocks.some(b => b.id === k.slice(10) && b.date === date);
    return false;
  })) return true;
}
// Commitments mode: only if a commitment is placed on this date
if (g.autoTrackMode === "commitments" && g.looseCommitmentIds.length) {
  if (data.commitments.some(c => g.looseCommitmentIds.includes(c.id) && c.date === date)) return true;
}
return false;
```

---

## Fix C: Description field missing from GoalDialog

**File:** `src/components/dashboard/GoalDialog.tsx`

1. Add import: `import { Textarea } from "@/components/ui/textarea";`
2. Add state: `const [description, setDescription] = useState(initial?.description ?? "");`
3. In `handleSave`: add `description: description.trim() || undefined,`
4. After title input, add:

```tsx
<div className="space-y-1">
  <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
    placeholder={g.descriptionPlaceholder ?? "Description (optional)"}
    className="min-h-[60px] text-xs resize-none" />
</div>
```

---

## Fix D: Tracking type badge on GoalCard

**File:** `src/components/dashboard/GoalCard.tsx`

After the kind badge (`line 95-97`), add a second muted badge:

```tsx
<span className="text-[9px] text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded shrink-0">
  {goal.tracking === "category"
    ? (goal.autoTrackMode === "always" ? "Always"
       : goal.autoTrackMode === "selected" ? "Selected"
       : goal.autoTrackMode === "commitments" ? "Commitments"
       : "Auto")
    : ({goal.tracking} label from i18n or capitalized tracking)}
</span>
```

And add `ListTodo, RefreshCw` to the lucide-react import (already used elsewhere, just ensure import is correct).

---

## Verify

```sh
corepack pnpm build
corepack pnpm lint
corepack pnpm test
```
