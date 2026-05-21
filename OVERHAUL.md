# Chronos System Overhaul Checklist

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

---

**Current step: 3 - Weekly Agenda polish and export validation** <- in progress
