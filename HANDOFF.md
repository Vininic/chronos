# Chronos — Handoff

_Last updated: 2026-06-21_

## Goal

Execute the 4-workstream triage plan derived from the README "needs polish" table
(`.claude/plans/the-readme-has-these-harmonic-yao.md`): kill false AI concerns on
templates at the root, redesign the Aetheris chat surface into one visual language,
lock already-working features (Planner→Gemini, TimerCard) behind regression tests,
and close the one real gap (Focus highlighting in the category creator).

**Status: all 4 workstreams COMPLETE and verified.** `npx tsc --noEmit` clean;
`corepack pnpm test` green (179 tests, 12 files, +7 new this pass).

## Current Progress

### WS1 — Templates: false AI concerns eliminated ✅
- **Phantom 8h sleep debt** fixed at root in `src/lib/ai/context/buildContext.ts`
  (`data.meta.sleepSchedule ?? migrateSleepSchedule(data)`) — corrects sleep metrics
  for ALL AI consumers (chat, digest, pipeline, briefing) at once.
- **Cross-day overlap hallucination**: new shared guard
  `src/lib/ai/core/validateConflictClaims.ts` (`filterHallucinatedConflicts` +
  `claimsTimeOverlap`), wired into `core/pipeline.ts` and `digest/generator.ts`.
  Day-grouped block serialization in `context/serializers.ts` (`serializeBlocksByDay`).
- **Regression suite**: `src/test/template-ai-context.test.ts` (34 tests) iterating
  `SCHEDULE_TEMPLATES` — asserts exact sleep debt + zero conflicts + weekday-grouped
  serialization per template.

### WS2 — Chat UI fuller redesign ✅
- `src/components/chat/ChatThread.tsx` fully rewritten:
  - `AetherisFrame` — bronze-spine + "Aetheris" byline wraps every assistant turn
    (replaces avatar bubbles).
  - `ActionLedger` family — ONE component for all tool-call states
    (`proposed` / `applied` / `error` / `undone`); `ToolChips`, `BlockGroups`,
    `ProposedGroups` share it. Replaced the old mismatched `ActionsCard` (dashed) +
    `ToolCallBadge` (solid).
  - Markdown renderer fixed: correct `##` > `###` hierarchy, links (http/https only),
    inline code, fenced code blocks, bronze `---` rules. `renderRichHtml` escapes first.
  - `ThinkingDots` + bronze streaming caret (both respect `motion-reduce`).
  - User bubbles: `rounded-br-sm bg-primary`, assistant: frame (no bubble).
- `src/components/digest/DigestView.tsx` + `ReportCard.tsx`: dropped the
  blue/purple/amber/teal timeframe rainbow; now Chronos bronze palette, accent driven
  by **severity**. `ReportCardView` no longer takes a `color` prop.
- `src/pages/dashboard/Aetheris.tsx`: unified sidebar tabs + quick-chips into one pill
  shape; collapsed two hand-rolled alert cards into a shared severity-driven
  `AlertCard` (removed dead `expandedRecovery` state).
- Deleted dead `src/components/chat/ChatInput.tsx` (Aetheris inlines its own input).

### WS3 — Lock in "done" work ✅
- `src/test/gemini-planner.test.ts` (5 tests): mocks `@/lib/ai/core/resolveProvider`;
  covers no-provider / unparseable / thrown-error fallbacks, valid-blueprint happy
  path (one `gemini-` proposal), and malformed-block dropping.
- `src/test/timer-card.test.tsx` (2 tests): idle (no transport controls) vs.
  active/running (readout + Pause/Reset) — driven via an in-provider start button.
- README + `checklist.md` corrected: Planner wiring, TimerCard, templates, chat UI,
  digest, Focus concept all marked done/accurate.

### WS4 — Focus highlighting in category creator ✅
- `src/pages/dashboard/Today.tsx` `BlockTypeGallery`: per-category "Focus"/"Foco"
  badge + inline `Target`-icon toggle button (`aria-pressed`), wired through new
  `onSetFocus` prop → `setFocusCategories` → `data.meta.focusCategoryIds`.
- Verified live: toggle round-trips (badge appears, aria-pressed flips, persists).

## What Worked

- **Single-point root fixes** for WS1 — fixing `buildContext` + one shared validator
  covered chat, digest, and pipeline simultaneously instead of patching each surface.
- **DOM-based verification** via `preview_eval` when `preview_screenshot` kept timing
  out (Three.js canvas makes capture hang). Querying `aria-pressed`, badge text, and
  localStorage proved behavior without screenshots.
- Seeding `localStorage` (`chronos.session.v1` for auth, `chronos.chat.v1` for the
  thread) to render states that need data — then clearing/reverting afterward.

## What Didn't Work

- **`preview_screenshot` times out (30s)** on this app — the Three.js (`@react-three`)
  background makes the renderer too heavy to capture. Use `preview_eval` DOM queries
  + `preview_console_logs` instead. (Don't keep retrying the screenshot.)
- **Dev server port confusion**: `preview_start` reports a port (e.g. 59372) but the
  app actually serves on **8080** (`.claude/launch.json` has `autoPort: true`). Probe
  with `fetch` and `window.location.replace("http://127.0.0.1:8080/")`.
- Routes are under `/dashboard/*` behind `RequireAuth` (e.g. `/dashboard/aetheris`,
  not `/aetheris`) — wrong paths log 404s. Auth key is `chronos.session.v1`.
- `getByText(/^25$/)` fails for the timer readout — `{mm}:{ss}` renders as one
  "25:00" string node; use `getByText("25:00")`.

## Next Steps

All planned work is done. Optional follow-ups (out of original scope):

1. ~~Seed `sleep` category cleanup~~ ✅ **Done.** Removed the `sleep` category +
   14 legacy `kind:"sleep"` routine blocks from `schedule-{en,pt}.json`;
   `agenda.ts` now takes an optional `sleepLabel` (default "Sleep") instead of
   reading the category; `ScheduleMigrator.normalizeNamingModel` drops a stray
   `sleep` category so old persisted data self-heals.
2. **Deferred from the plan** (explicitly out of scope this pass): Today page
   decomposition (71 KB), DayPlanner split (130 KB), broader AI test coverage
   (chat service, tools, pipeline), digest prompt-quality redesign, delete
   `Hourglass3D` + drop `three`/`@react-three/*` deps.

## Verify

```sh
npx tsc --noEmit          # clean
corepack pnpm test        # 179 passing
```

Preview: server on `127.0.0.1:8080`; auth via `localStorage["chronos.session.v1"]`;
verify UI through `preview_eval` DOM queries (NOT screenshots).
