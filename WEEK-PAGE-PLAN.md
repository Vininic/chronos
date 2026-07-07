# Week Page Overhaul — Plan

Goal: make the Week page ("Semana") a genuinely useful control surface for
goals/categories/habits, not just a stats readout. Written so anyone (including
a fresh Claude session) can pick this up mid-flight — check the boxes as you go
and update the "Status" line at the top of each phase.

Source page: `src/pages/dashboard/Week.tsx`. Background research that grounds
every phase below (file:line references, what already exists vs. what's new)
lives in the session transcript from 2026-07-07 — the summary is folded into
each phase's "Why this is scoped this way" note.

## Phase 0 — Reorder (done)

**Status: ✅ done, 2026-07-07.**

Moved the `WeeklyRoutine` grid above the mini stats row in the `tab === "week"`
branch of `Week.tsx`. Pure JSX move, no data changes, no new tests needed.
Verified visually (grid now renders first) and `pnpm test` (365/365) +
`tsc --noEmit` both clean.

## Phase 1 — Category ↔ Goal allocation view

**Status: not started.**

**Why this is scoped this way:** `Goal.categoryId` + `tracking: "category"`
already links a goal to one category (`src/lib/schedule/types.ts:126-146`).
There is no reverse index ("which goals draw from category X") and no visual
for it anywhere in the app — not even the digest module, which only produces
a text warning when a goal's category has zero scheduled blocks
(`src/lib/digest/modules/goal-alignment.ts:36-54`). This phase is pure
UI + a derived (non-persisted) index — no schema change.

**What to build:**
- A small derived map: `Map<categoryId, Goal[]>` built once per render from
  `data.goals.filter(g => g.categoryId)`, grouped by `categoryId`.
- A new compact widget on the Week page (`week` tab), placed between the
  routine grid and the mini stats row: one row per category that has at least
  one linked goal, showing the category's color/label + the goal(s) drawing
  from it + each goal's current period progress (reuse `computeGoalProgress`
  — don't recompute progress math, it's already covered by
  `src/test/goal-progress.test.ts`).
- Categories with zero linked goals: either omit them or collapse into a
  "N unallocated categories" line — your call, but don't render 15 empty rows.
- No new goal-editing affordance needed here yet; this widget is read-only.
  Editing/assigning stays in `GoalDialog`/`GoalList`'s existing "Assign" flow.

**Files you'll touch:** `Week.tsx` (new section), possibly a new
`src/components/dashboard/CategoryGoalMap.tsx` if the JSX gets bulky enough to
warrant extraction (probably yes, keep `Week.tsx` from growing past ~600 lines).

## Phase 2 — Week-page filters (category + period)

**Status: not started.**

**Why this is scoped this way:** The only filter UI in the app today is
`GoalList`'s `kindFilter`/`sortBy` (`src/components/dashboard/GoalList.tsx:34,
82-97`) — local `useState` + shadcn `Select`, filtered client-side. There's no
shared `<Filter>` component to import; mirror that pattern inline for
consistency, don't invent a new interaction style.

**What to build:**
- A category filter (multi-select or single-select — recommend single-select
  first, "All categories" default, to match `GoalList`'s existing pattern)
  that scopes the `WeeklyRoutine` grid to only the selected category's blocks,
  and scopes the Phase 1 category↔goal widget to that category if set.
- Optionally a "sleep only" quick-toggle, since sleep is visually distinct
  (striped) in the grid already — check whether `WeeklyRoutine` accepts a
  filter prop or needs one added (`src/components/dashboard/widgets.tsx`,
  search for `WeeklyRoutine`).
- Filter state can be local `useState` in `Week.tsx`, no need for URL params
  or persistence unless you specifically want the filter to survive a reload.

**Files you'll touch:** `Week.tsx`, `src/components/dashboard/widgets.tsx`
(only if `WeeklyRoutine` needs a new prop to filter which blocks it draws).

## Phase 3 — Per-instance attendance tracking (the "gym 5x, need 4" feature)

**Status: not started. This is the big one — new data model, not just UI.**

**Why this is scoped this way:** searched exhaustively (`attended`,
`attendance`, `completedInstances`, `checkedOff`, `habitTracking`) — this
concept **does not exist anywhere** in the codebase today. The closest
mechanisms and why none of them fit:
- `GoalBlock.done` (`types.ts:115-124`) is a **freeform manual log** the user
  creates themselves (title/duration/date) — not tied to a specific recurring
  `RoutineBlock` occurrence.
- `autoTrackMode: "selected"` + `trackedBlockKeys` lets a user pre-select
  *which recurring blocks count at all* toward a goal — a one-time
  assignment, not a per-week "did this Tuesday's occurrence happen" toggle.
- `commitmentIsDone(c, now)` (`types.ts:467`) is purely **time-elapsed**
  (block's end time passed ⇒ "done"), regardless of whether the user actually
  showed up.
- `dailyLog.ts`'s `autoCaptureLogs` explicitly records what was **scheduled**,
  not what happened (comment at line 60) — it's an analytics snapshot, not a
  user-editable attendance record.

A `RoutineBlock` is a weekly-repeating *template* (`day: 0-6`), so "this
week's Tuesday gym session" has no row of its own anywhere — you can't attach
a boolean to it without inventing an instance key.

**Data model to add** (in `src/lib/schedule/types.ts`):
```ts
export interface BlockAttendance {
  /** `routine-<routineBlockId>-<yyyy-mm-dd>` or `commitment-<commitmentId>`. */
  key: string;
  date: string; // yyyy-mm-dd, the occurrence's date
  status: "went" | "skipped";
  markedAt: string; // ISO timestamp
}
```
Add `attendance: BlockAttendance[]` to `ScheduleData`. Bump the schema
migration version (check `src/lib/schedule/migrate.ts` or equivalent — find
wherever `ScheduleData` versioning lives before touching this) and default
`attendance: []` for existing users. **Open question to resolve before
coding:** can a `Commitment` recur, or is it always a single dated
occurrence? If it's always single-dated, `commitment-<id>` is a safe key with
no date-collision risk; if commitments can recur, they need the same
`<id>-<date>` composite key as routine blocks. Check
`src/lib/schedule/types.ts`'s `Commitment` interface and any recurrence field
before committing to the key format above.

**UI to add:**
- Once a block's occurrence end-time has passed (reuse the same time
  comparison `commitmentIsDone` already does), show an inline, low-friction
  "Foi? Sim / Não" (Went? Yes/No) affordance on that occurrence — in the
  `WeeklyRoutine` grid cell itself (hover or a small icon that's always
  visible once elapsed) rather than a modal, per the user's "marcaria
  intuitivamente" ask. Undecided vs. answered should look visually distinct
  (e.g. a faint outline until answered).
- Store the answer via a new store action, e.g. `setAttendance(key, date,
  status)`, mirroring the style of existing actions like `toggleGoalBlock`.

**Files you'll touch:** `src/lib/schedule/types.ts` (new type + field),
migration file, `src/lib/schedule/store.tsx` (or wherever the schedule
context/actions live — grep for `toggleGoalBlock` to find it), `widgets.tsx`
(`WeeklyRoutine` needs the new interactive affordance), new test file
`src/test/attendance.test.ts` mirroring the style of `goal-progress.test.ts`.

## Phase 4 — Wire attendance into goal progress

**Status: not started. Depends on Phase 3.**

**Why this is scoped this way:** `computeGoalProgress` (`types.ts:473`,
tested exhaustively in `goal-progress.test.ts`, 594 lines) is the single
source of truth for every goal's numerator/denominator across all tracking
modes. It must stay backward compatible — existing goals should keep counting
*scheduled* occurrences unless a user explicitly opts a goal into
attendance-based counting.

**What to build:**
- Add a new `autoTrackMode` value, e.g. `"attendance"`, alongside the existing
  `"always" | "selected" | "commitments"`. When set, `computeGoalProgress`
  counts occurrences where a matching `BlockAttendance.status === "went"`
  within the goal's period, instead of counting every scheduled occurrence.
- Default every existing/new goal to the current behavior; attendance mode is
  strictly opt-in via the goal edit dialog (`GoalDialog.tsx`).
- **Every change here needs a matching test added to
  `goal-progress.test.ts`** in the same style as the existing coverage
  (period × kind × tracking-mode matrix) — don't skip this, it's the one file
  standing between "confident refactor" and "silent regression" for the goal
  engine.

**Files you'll touch:** `src/lib/schedule/types.ts` (`computeGoalProgress`,
`GoalAutoTrackMode` type), `GoalDialog.tsx` (new UI option), `test/
goal-progress.test.ts`.

## Suggested order of execution

Phases 1 and 2 are independent of each other and of Phase 3/4 — either can go
first, and both are low-risk (no schema changes). Phase 3 is the load-bearing
one: nothing in Phase 4 can start until the attendance data model and its
store action exist. Recommend: **Phase 1 → Phase 2 → Phase 3 → Phase 4**, but
if you only have time for one more thing, Phase 3 alone (even without Phase 4
wired up) already answers "did I go to the gym this week" as a standalone
tracker, which may be enough on its own.
