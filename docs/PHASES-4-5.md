# Chronos — Implementation Guide: Phases 4 & 5

> Detailed, file-level instructions for the two remaining roadmap phases, plus a
> bonus design for a **detachable real-time "Aetheris preview" timeline** that the
> Phase 4 split unlocks.
>
> **Baseline before starting:** `npx tsc --noEmit -p tsconfig.app.json` = 0 errors,
> `npx vitest run` = 317 green. Keep that gate after every step. Work on a feature
> branch off `triage/ai-concerns-chat-redesign` (or `main` once merged).

---

## Phase 4 — Split the giants (behavior-preserving)

Two files dominate the repo: `DayPlanner.tsx` (~2,600 lines) and `Today.tsx`
(~1,300 lines). The goal is **separation of concerns with zero behavior change** —
the existing tests + the live preview are the safety net. Extract in order of
*increasing risk*, verifying after each step.

### 4.0 Principles
- **One extraction = one commit.** Never batch. After each: `tsc` + `vitest` + a
  preview smoke of the exact interaction you touched.
- **Pure logic → `src/lib/…`, presentation → components, side-effects stay thin.**
- **Decouple from the global store where it unlocks reuse.** Today both
  `DayPlanner` and its inner dialogs call `useSchedule()` directly
  (`DayPlanner.tsx` ~line 261, dialogs ~1880/2030). Pushing `data`/mutators toward
  **props or a scoped provider** is what makes the bonus preview timeline possible
  (see "Bonus" below) — do it deliberately in step 4.1.4.

### 4.1 DayPlanner.tsx → modules

Current shape (verify against the file; line numbers drift):
- `forwardRef<DayPlannerHandle, DayPlannerProps>`, props `{ onCommitmentDrop, assignGoalId, onAssignMode }`.
- Reads `data` + mutators from `useSchedule()`; builds the day view via `buildAgendaForDate(data, selectedDate)`.
- Sections: **(a)** module-scope utils (note parse/serialize, timeline math, `formatClock`), **(b)** drag engine (`pushMoveDayChain` cascade + `onGripDown`/`onPointerMove`/`onPointerUp`), **(c)** grid/timeline render, **(d)** block render with tier logic (micro/compact/hour/full), **(e)** three dialogs (`BlockDetailsDialog`, `BlockEditDialog`, `SleepEditDialog`, ~700 lines).

**Extraction order:**

1. **Pure utils → `src/lib/schedule/planner-format.ts`** (lowest risk).
   Move: `parseNoteLine`, `parseNotes`, `serializeNotes`, `renderLinkedText`
   (returns React nodes — keep in a `.tsx` if it has JSX, e.g. `planner-notes.tsx`),
   `buildTimeline`, `topFor`, `blockHeight`, `freeHeight`, and the duplicated
   `formatClock` / `fmtFriendlyDuration` (these are copied in `Today.tsx` too — make
   this the single source and import in both). Add `src/test/planner-format.test.ts`.

2. **Dialogs → own files** `src/components/dashboard/planner/BlockDetailsDialog.tsx`,
   `BlockEditDialog.tsx`, `SleepEditDialog.tsx`. They are already self-contained
   modals; move verbatim, keep their `useSchedule()` calls for now. Pure win, ~700
   lines out. Verify: open each dialog in the preview, edit, save, delete.

3. **Drag → `useDayPlannerDrag()` hook** in `src/components/dashboard/planner/useDayPlannerDrag.ts`.
   Extract `dragState`, the cascade (`pushMoveDayChain` lives in the store — keep
   calling it), and the three pointer handlers. The hook returns
   `{ dragState, onGripDown, onPointerMove, onPointerUp, previewDeltaMin }`.
   **Move the pure geometry** (snap, collision math, cross-day delta) into
   `src/lib/schedule/planner-drag-math.ts` and unit-test it — `planner-drag.test.ts`
   already covers `snapTime`/`clockTimeFromMin`/agenda math, so extend it.

4. **Render → presentational components driven by PROPS** (the key seam):
   - `src/components/dashboard/planner/TimelineGrid.tsx` — hour/quarter lines,
     now-line, sleep boundary badges. Props: `{ timeline, boundaries, nowMin }`.
   - `src/components/dashboard/planner/BlockRenderer.tsx` — positioned block cards +
     tier logic + session badges. Props: `{ items, draggingId, dragDeltaMin, onGrip, ghost?, diff? }`.
   - **Critical:** these take their data via props, **not** `useSchedule()`. This is
     what lets a second, read-only instance render a *proposed* schedule (bonus).
   - `DayPlanner.tsx` becomes a ~400–500-line orchestrator: read store → build agenda
     → wire `useDayPlannerDrag` → render `<TimelineGrid>` + `<BlockRenderer>` + dialogs.

**Verification (every step):** `tsc` + `vitest`; preview the day view — drag a block,
cross-midnight drag, resize, open all three dialogs, edit sleep window. Behavior must
be pixel-identical.

### 4.2 Today.tsx → modules
- **Extract `BlockTypeGallery`** (~380 lines, the inline category editor) →
  `src/components/dashboard/BlockTypeGallery.tsx`. It owns its own edit/delete/
  color-picker/preset state; move as-is.
- **Extract hooks** → `src/components/dashboard/today/useCurrentNextBlock.ts`
  (current/next block + sleep-window display logic) and `useDailyStats.ts`
  (DayProgress / FocusRecovery / AgendaStats computations; keep the three cards as
  thin render components).
- **Dedup format helpers** with step 4.1.1 (`formatClock`, `fmtFriendlyDuration`).
- Result: `Today.tsx` drops to ~500 lines, each section single-purpose.

### 4.3 Tests to add in Phase 4
- `planner-format.test.ts` — note parse/serialize round-trip, timeline math.
- Extend `planner-drag.test.ts` — extracted collision/cross-day geometry.
- (Optional) lightweight render tests for `TimelineGrid`/`BlockRenderer` with a fixed
  agenda fixture (mirrors `timer-card.test.tsx` style).

---

## Phase 5 — Product features (PWA → Cloud sync → Push)

Build in dependency order. Each is an epic; ship independently.

### 5.1 PWA / offline  *(M–L)*
Data already persists to `localStorage`, so offline-first is mostly app-shell caching.
1. `npm i -D vite-plugin-pwa` and register it in `vite.config.ts` (dev server is on
   port 8080 — keep that).
   ```ts
   import { VitePWA } from "vite-plugin-pwa";
   // plugins: [ react(), VitePWA({ registerType: "autoUpdate",
   //   manifest: { name: "Chronos", short_name: "Chronos", theme_color: "#…",
   //     icons: [/* 192 + 512 png, maskable */] },
   //   workbox: { globPatterns: ["**/*.{js,css,html,svg,woff2}"] } }) ]
   ```
2. Add icons under `public/` (192×192, 512×512, maskable). Add `<meta name="theme-color">`.
3. Show an "update available" toast using the plugin's `useRegisterSW` (wire to the
   existing `sonner` toaster).
4. **Verify:** build + preview; Chrome DevTools → Application → Manifest is
   installable; toggle Offline and reload — the app shell + last schedule load.

### 5.2 Cloud sync (Supabase)  *(XL)*  — uses the clean repository seam
The architecture already has a swappable port: `src/lib/schedule/ports/ScheduleRepository.ts`
(interface + `SCHEMA_VERSION`) with `src/lib/schedule/infrastructure/LocalStorageScheduleRepository.ts`
as the only impl. Cloud sync = a second impl + real auth.
1. `npm i @supabase/supabase-js`. Create `src/lib/supabase/client.ts` (URL + anon key
   from `VITE_SUPABASE_*` env).
2. **`SupabaseScheduleRepository`** in `src/lib/schedule/infrastructure/` implementing
   the same `ScheduleRepository` port (`load`/`save`/migrate). Table `schedules
   (user_id uuid pk, version int, data jsonb, updated_at timestamptz)`. Reuse
   `ScheduleMigrator.normalizeNamingModel` on read so cloud rows migrate like local.
3. **Auth swap:** `src/lib/auth.tsx` is a local fake (session key
   `chronos.session.v1`). Add a Supabase-backed `AuthProvider` variant (magic-link or
   OAuth) behind the same `useAuth()` contract (`session`, `signIn`, `signOut`).
4. **Conflict strategy:** start with last-write-wins keyed on `updated_at` + the
   existing schedule `version`; surface a "remote is newer — keep local / use remote"
   prompt on conflict. (A field-level merge is a later refinement.)
5. **Migration & opt-in:** sync is **opt-in** (it breaks the local-first promise that
   "data never leaves the browser"). Add a Settings toggle; on enable, push the local
   schedule up once, then read-through. Pick the repo impl at the provider boundary
   (a `RepositoryProvider` choosing Local vs Supabase based on the toggle + auth).
6. **Verify:** sign in on two browsers, edit in one, confirm the other converges;
   disable sync → back to pure local.

### 5.3 Push notifications  *(L)*  — depends on 5.1 + a backend trigger
Local-first has no server cron, so notifications need either the PWA service worker
(for app-foreground/timed) or a backend (Supabase Edge Function + Web Push) for
true background delivery.
1. **Permission + subscription:** request `Notification` permission from Settings;
   `registration.pushManager.subscribe({ applicationServerKey: VAPID })`; store the
   subscription in Supabase (requires 5.2 or a minimal endpoint).
2. **Service worker push handler:** in the SW (from 5.1), handle `push` →
   `showNotification`. Click → focus the app at the relevant date/block.
3. **Triggers:** Supabase Edge Function (scheduled) computes upcoming block starts /
   session ends from the user's schedule and sends Web Push. Cases: block start
   reminder, focus-session end, daily briefing.
4. **Verify:** subscribe, schedule a block ~2 min out, confirm the notification fires
   and deep-links correctly. Test permission-denied and unsubscribed paths.

---

## ★ Bonus — Detachable real-time "Aetheris preview" timeline

**Goal:** when Aetheris proposes changes (chat tool calls or analysis actions),
render them on a **ghost / detached timeline** in real time so the user *sees* the
projected schedule and accepts or rejects — instead of changes landing blind.

**Why Phase 4 unlocks this:** today `DayPlanner` reads the live schedule straight
from `useSchedule()`, so it can only ever show *current* state. After step 4.1.4 the
timeline is a presentational subtree driven by data, so you can mount a **second,
read-only instance fed a *proposed* `ScheduleData`**. Two ways to feed it (B is the
most reuse):

- **(A) Prop-driven:** `<TimelineGrid data={proposed} ghost diff={diff} readOnly>` —
  explicit, simple, but you prop-drill the proposed data.
- **(B) Scoped ephemeral provider (recommended):** make `ScheduleProvider` accept
  `initialData?: ScheduleData` + `persist?: boolean`. Wrap a read-only `<DayPlanner>`
  in `<ScheduleProvider initialData={proposed} persist={false}>` — every child's
  `useSchedule()` now returns the *proposed* schedule, no localStorage writes, **zero
  component changes**. This reuses the whole timeline + block-render + tier logic.

### Data flow
1. **Source of the proposal.** Two existing producers:
   - Analysis: the pipeline already returns `suggestedActions: ActionProposal[]`
     (`{ action, params, reason, impact, confidence }` — `core/pipeline.ts` / `core/schemas.ts`).
   - Chat: `extractToolCalls(text)` (`ai/chat/service.ts`) yields `[{ tool, params }]`.
   Normalize both into a single `ProposedMutation[]`.
2. **Dry-run apply (pure).** New module `src/lib/schedule/proposeChanges.ts`:
   ```ts
   export function applyProposedMutations(
     base: ScheduleData,
     mutations: ProposedMutation[],
   ): ScheduleData            // deep-clone base, interpret add/move/update/delete_* on the clone, return it
   ```
   Implement it with the **same semantics** the live tools use, but writing to the
   clone (don't touch the store). Tip: you can instantiate a fresh `ToolRegistry`
   (the class is already unit-tested) bound to *clone* mutators, or interpret the
   ~8 action verbs directly — either way it's pure and testable.
3. **Diff.** `src/lib/schedule/diffSchedules.ts`:
   ```ts
   export interface ScheduleDiff { added: string[]; removed: string[]; moved: string[]; edited: string[] } // block ids
   export function diffSchedules(live: ScheduleData, proposed: ScheduleData): ScheduleDiff
   ```
4. **Render the preview.** `BlockRenderer` gains an optional `ghost`/`diff` prop:
   added = dashed-green, removed = struck/red ghost, moved = arrow from old→new slot,
   edited = amber outline. Drive it from `diffSchedules`.
5. **Accept / Reject.** Accept → `replace(proposed)` (the store already exposes
   `replace(next: ScheduleData)`). Reject → drop the preview. This makes the AI's
   write path *reviewable* and reuses the existing apply.

### "Detachable" UX
- **In-page split:** `react-resizable-panels` is already a dependency — render
  `live | proposed` side-by-side in a resizable two-pane, or a single timeline with a
  "Preview changes" ghost overlay toggle.
- **Pop-out window (advanced):** `const w = window.open(...)` + a React portal into
  `w.document.body`, wrapped in the same ephemeral `<ScheduleProvider>` — a literally
  detached timeline window that updates live as the chat streams.
- **Live updates:** recompute `proposed = applyProposedMutations(live, mutations)` on
  every change to the AI's pending mutations (debounced), so as Aetheris streams a
  plan the ghost timeline animates into place.

### Build order (mostly after 4.1.4)
1. `ScheduleProvider` gains `initialData?` + `persist?` (small, isolated store change) — **do this in Phase 4** so the seam exists.
2. `proposeChanges.ts` + `diffSchedules.ts` + tests (pure, no UI).
3. `ghost`/`diff` support in `BlockRenderer`.
4. `<ProposalPreview>` panel (ephemeral provider + read-only DayPlanner + diff badges + Accept/Reject), mounted in the Aetheris hub.
5. Wire chat/analysis proposals → preview; then the pop-out window if desired.

**Effort:** ~M for the in-page split (steps 1–4), +S for streaming/live updates, +M
for the pop-out window. **Risk:** low/contained — it's additive and read-only until
the user hits Accept. The one prerequisite is the Phase 4.1.4 prop/provider seam.

---

## Verification matrix

| Phase | Gate | Smoke |
|---|---|---|
| 4.1 / 4.2 (each step) | `tsc -p tsconfig.app.json` 0 · `vitest` green | Preview: drag (incl. cross-midnight), resize, 3 dialogs, sleep edit, BlockTypeGallery edit — identical |
| 5.1 PWA | build + manifest valid | Installable; offline reload loads shell + schedule |
| 5.2 Cloud sync | `tsc` · `vitest` | Two-browser convergence; disable → local-only |
| 5.3 Push | — | Block-start notification fires + deep-links; denied/unsub paths |
| ★ Preview | new pure-module tests green | Aetheris proposal renders ghost; Accept mutates, Reject discards |

## Recommended sequence
**Phase 4 first** (makes everything else sustainable *and* builds the preview seam) →
**★ Detachable preview** (high-delight, low-risk, rides the split) → **5.1 PWA** →
**5.2 Cloud sync** → **5.3 Push**. Phases 4 + ★ are days; Phase 5 is a multi-week
product track and can be its own milestone.
