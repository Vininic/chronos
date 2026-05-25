# Chronos System Overhaul Checklist

## TOP PRIORITY - 2026-05-24 Crossday drag symmetry blocker (must fix next)

- [ ] Critical blocker: crossday drag behavior is still asymmetric and unstable around `00:00`.
- [ ] Repro 1: dragging from `00:00` on the next-day side can ignore or fake the lower-limit cue and still move into a broken state.
- [ ] Repro 2: detaching from the top-origin crossday path can still break the block state in some drag sequences.
- [ ] Repro 3: lower-limit warning may render but not represent true commit behavior (preview/commit mismatch).
- [ ] Root-cause focus for next session: unify preview clamp rules with commit transfer rules so limits, glow state, and persisted result always match.
- [ ] Keep glow bar anchor fixed per originating edge; only icon direction may change.
- [ ] Add deterministic regression tests for both directions at `00:00` thresholds (15m hint and 30m solid states).

### Related in-progress changes to carry forward

- [ ] `DayPlanner.tsx`: multiple drag preview/commit threshold iterations (raw vs clamped delta handling, crossday hint behavior).
- [ ] `store.tsx`: crossday transfer/retention rules changed several times and require consolidation.
- [ ] `Today.tsx` and schedule type/dialog files were updated during this same refactor window and should be validated together in the next pass.

## 1. Daily Agenda (Today page) - `DayPlanner.tsx`

- [x] Fix expand/collapse - any block can toggle; only the live block expands by default
- [x] Add drag-to-reorder: blocks are draggable along the timeline (Y axis = time, snaps to 15 min)
- [x] Render free-time slots between blocks as "Free" placeholder blocks (virtual, not stored)
- [x] Block detail view: show full info (category chip, notes, duration) cleanly on expand
- [x] Replace inline BlockEditor with a clean Dialog popup - fewer buttons, clearer layout
- [x] Sidebar stays static while main content scrolls (layout fix)

## 2. Block Data Model

- [x] Routine blocks are "default" - repeat every week, conflict-validated against other routine blocks
- [x] Commitment is one-time - overrides/overlaps routine without conflict error
- [x] "Free" (unallocated time) is its own virtual block/category shown in both agendas
- [x] Sleep is a system-baked category in JSON seed (EN/PT)
- [x] Drag chain ignores sleep boundary blocks
- [x] Reflect new model in localStorage schema

## 3. Weekly Agenda (Week page) - `Week.tsx`

- [ ] Blocks are draggable on the week grid (change day + time)
- [ ] Expand a block in the grid for full detail
- [x] Edit controls simplified - single pencil icon opens a dialog (no inline nudge buttons)
- [ ] "Now" bar on the weekly grid aligned to current day + time
- [x] Free-time blocks rendered per-day in the week grid

## 4. AI Assistant (Aetheris page)

- [ ] Audit current suggestion engine - confirm it actually runs
- [ ] "Generate from scratch" feature: analyze empty routine and propose a full week template
- [ ] Predefined templates: Deep-worker, Balanced, Executive, Recovery-focused
- [ ] "Apply suggestion" actually patches the schedule and persists
- [ ] Show applied vs deferred suggestion history

## 5. JSON / Export accuracy

- [x] JSON seed updated to reflect the v2 schedule model
- [ ] XLSX export: properly formatted table with accurate sheet names, column headers, and data
- [ ] ICS export: commitments correctly produce non-recurring events
- [ ] JSON export/import round-trips without losing custom names or overrides

## 6. Layout & Sidebar

- [x] Sidebar is `h-screen sticky top-0 overflow-y-auto` - does not grow with page content
- [x] Main content area is independently scrollable

## 7. Settings / Config

- [ ] Settings page becomes a popup/dialog overlay rather than a separate route
- [ ] Same for Support page
- [ ] Trigger from sidebar nav items (clicking opens overlay, not navigation)
- [ ] All category editing, data management, and export controls inside the overlay

## 8. Session Log - 2026-05-07

### Solved in that session

- [x] Added sleep as first-class category across types/seeds/i18n/text helpers
- [x] Reworked DayPlanner visuals (now-line behavior, free-slot add flow, sleep markers)
- [x] Fixed upward drag chain bug (only cascades when overlap exists)
- [x] Added sleep marker editing via dedicated sleep dialog
- [x] Standardized time input behavior via custom time select (locale-consistent display)
- [x] Added cross-day commitment support in model + conflict checks + day-segment rendering
- [x] Added sleep window policy in `meta.sleepWindow` with migration fallback from legacy sleep routine blocks

### Still open from that stage

- [ ] Add explicit end-date UI for commitments (currently overnight is inferred from end <= start)
- [ ] Optionally support commitments spanning more than one day in creation/edit dialogs
- [ ] Decide whether to keep or clean up legacy sleep routine entries in persisted datasets
- [ ] Re-test week view and export paths with cross-day commitments
- [ ] Add tests for sleep window derivation and cross-day conflict rules

## 9. Session Log - 2026-05-21

### Solved in this session

- [x] Reopened the project and resumed from the overhaul checklist
- [x] Added a real `README.md` with stack, local run instructions, and current data-model notes
- [x] Bumped the schedule schema to v2 in seeds and local persistence
- [x] Added fallback loading from legacy `chronos.schedule.v1`
- [x] Preserved routine-routine conflict validation while allowing commitments to overlap routine blocks
- [x] Updated the daily agenda builder so one-time commitments visually override recurring routine blocks
- [x] Prevented derived routine fragments from exposing misleading drag/edit behavior in the daily planner
- [x] Added free-time rendering to the weekly routine grid so the "free" concept appears in both agendas
- [x] Validated the project with a successful production build after the changes

### Next tasks

- [ ] Add drag and rescheduling directly on the weekly grid
- [ ] Add expand/detail behavior inside the weekly grid itself
- [ ] Add a current-time marker to the weekly grid
- [ ] Re-test exports (JSON / XLSX / ICS) against the v2 model
- [ ] Decide whether derived routine segments should gain a dedicated visual explanation in Today
- [ ] Add automated tests for commitment-overrides-routine behavior

## 10. Session Log - 2026-05-21 (round 2)

### Solved in this session

- [x] Allowed recurring routine blocks to span midnight through `endsNextDay`
- [x] Updated routine conflict validation so overnight routine blocks are checked correctly against other routine blocks
- [x] Relaxed the daily planner visible-range logic so it is no longer hard-clamped by sleep boundaries
- [x] Improved `Jump to now` reliability by forcing the current time into the visible range on the current day
- [x] Updated compose flow so new blocks use the currently visible day/date instead of always defaulting to today
- [x] Added explicit end-date input for commitments in the creation dialog
- [x] Made notes visible inside blocks as highlighted inline reminders instead of only hidden below on expand
- [x] Reduced small-block UI breakage by adapting note rendering and lowering the free-slot `+` threshold
- [x] Localized sleep markers with locale-aware time formatting instead of raw 24h strings everywhere

### Still open from this round

- [ ] Validate and polish the weekly grid for overnight routine blocks across all edge cases
- [ ] Add drag and rescheduling directly on the weekly grid
- [ ] Add expand/detail behavior inside the weekly grid itself
- [ ] Review other locale inconsistencies beyond sleep markers
- [ ] Re-test commitment editing with explicit end date and overnight routines mixed together
- [ ] Re-test exports (JSON / XLSX / ICS) against overnight routine + multi-day commitment cases

---

**Current step: 3 - Weekly Agenda polish, overnight edge cases, and export validation** <- in progress

## 11. Session Log - 2026-05-21 (round 3)

### Solved in this session

- [x] Fixed Dashboard crash caused by stale `expanded` reference in `DayPlanner.tsx`
- [x] Revalidated Dashboard rendering after auth/login flow
- [x] Fixed Today timeline end-cap regression: when sleep starts at `22:15`, the visible time bar now stops correctly and no longer shows `23:00`
- [x] Kept "jump to now" behavior while respecting explicit sleep boundaries (`morningSleep.end` / `eveningSleep.start`)

### Small-block polish backlog (next)

- [ ] Audit very short block rendering (`< 44px`) for text/icon overlap in all locales (PT/EN)
- [ ] Keep title, kind chip, and notes indicator stable for compact blocks (prevent jitter on hover/drag)
- [ ] Recheck free-slot add (`+`) visibility thresholds to avoid clipped buttons in narrow slots
- [ ] Ensure drag handle and edit affordance remain usable for tiny blocks on touch + mouse
- [ ] Revisit compact-note truncation/line-clamp behavior so notes do not collide with controls

### Cross-day backlog (next)

- [ ] Re-test cross-day commitments with explicit end date across create/edit/remove flows
- [ ] Validate day-splitting visuals at midnight boundaries in Today and Week views
- [ ] Verify duration and label correctness for overnight segments (including derived routine fragments)
- [ ] Confirm drag/reschedule behavior does not corrupt `endsNextDay` semantics
- [ ] Re-test exports (JSON/XLSX/ICS) with overnight routine + cross-day commitment combinations
- [ ] Add focused automated tests for cross-day overlap/conflict and timeline clipping edge cases

### Resume starting point

- [ ] Start with small-block audit in Today, then run cross-day regression sweep (Today -> Week -> exports)

---

**Current step: 3 - Weekly Agenda polish + small-block and cross-day regression fixes** <- in progress

## MAX PRIORITY - Drag regressions to fix later

- [ ] Crossday routine drag can feel glued to the bottom edge instead of moving freely upward.
- [ ] Dragging a crossday block downward can shrink the visible span instead of preserving duration.
- [ ] Dragging a crossday block near another block can act like a magnet and snap too aggressively.
- [ ] Crossday blocks can lose the clear top/bottom spill signal during drag.
- [ ] Block time rows can still render in the wrong position or read as secondary metadata.
- [ ] Drag interactions need a dedicated regression sweep after any sleep/timeline layout change.

## 12. Session Log - 2026-05-22 (round 4)

### Solved in this session

- [x] Fixed small-block/free-slot visual overlap in Today by clamping rendered heights to the next timeline item's top
- [x] Improved tiny/compact block rendering so title + controls remain visible without clipping
- [x] Reworked sticky notes in Today blocks:
	- [x] tiny blocks show a visible sticky badge icon
	- [x] larger blocks show inline sticky preview text
	- [x] notes are no longer effectively hidden in compact states
- [x] Implemented explicit cross-day segment boundaries using `24:00` -> `00:00` split semantics in agenda building
- [x] Added continuation flags for cross-day segments and rendered flat top/bottom edges where midnight split joins occur
- [x] Updated weekly routine split rendering to use `24:00` segment end (instead of `23:59`)
- [x] Upgraded sleep editing to full window editing (`start` + `end`) in one dialog
- [x] Added same-day sleep support path (e.g. `03:00` to `13:00`) while preserving overnight behavior

### Still open from this round

- [ ] Validate cross-day flat-edge visuals in all block kinds on Week grid (not only Today)
- [ ] Re-test drag/move behavior for cross-day commitments after `24:00` boundary normalization
- [ ] Re-test exports (JSON/XLSX/ICS) with `24:00` boundary segments and same-day sleep windows
- [ ] Add automated tests for:
	- [ ] non-overlapping visual layout in dense tiny-block timelines
	- [ ] same-day sleep window rendering and editing
	- [ ] midnight-split continuation edge styling

### Resume starting point

- [ ] Run full regression sweep: Today (tiny blocks + notes) -> Week (cross-day visuals) -> exports

---

**Current step: 3 - Weekly Agenda polish + cross-day and tiny-block regression validation** <- in progress
