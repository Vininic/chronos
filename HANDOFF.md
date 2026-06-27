# HANDOFF — Planner redesign (draft + visual chat)

> Scope of this handoff: **redesign the Planner** into a non-destructive *draft* flow
> with a live week preview and an Aetheris-powered *visual chat* to personalize, applied
> only at the end. Everything else in the app is shipped and green.

## Goal

Replace the current 4-step Planner wizard with a cleaner flow:

1. **Pick a start:** a template, an AI-generated plan, or "from scratch".
2. **Refine a DRAFT** with a **live week preview** beside it, plus a clean
   **"bedtime / wake" sleep control**.
3. **Personalize via a visual chat** (when AI is available): the user types
   *"make Tuesdays lighter"*, *"gym Mon/Wed/Fri 7am"*, *"deep work in the morning"* and
   the **draft** updates live.
4. **Apply** → commits the draft to the real schedule.

### Locked design decisions (confirmed with the owner)
- **Chat edits a non-destructive DRAFT**, not the live schedule. Nothing touches the real
  agenda until the user clicks **Apply** (they can discard).
- **No AI configured → fall back to the template/manual flow.** The chat panel only
  appears when an AI provider is usable (`isProviderConfigured` / `isAiProxyAvailable`).
  The Planner must never be unusable without AI.

## Current Progress

### Already fixed this session (committed to `main`)
- **"Sleep" base-category chip removed** from `CategoryInput` — sleep is structural (the
  sleep window), never a user routine category. (`src/components/planner/CategoryInput.tsx`)
- **Stale "10 modelos" copy fixed** — there are **14** templates; PT copy is now
  count-agnostic. (`src/lib/i18n/dictionaries.ts`, key `plannerPage.builder.templateDesc`)
- **"From scratch" no longer empty** — `createEmptySchedule()` returns 0 categories/0
  blocks, so Apply looked broken. Scratch now seeds the base category palette via the
  newly-exported `baseCategories()`. (`PlannerBuilder.tsx` `handleStartPointChoice` +
  `handleRegenerate`; `templates.ts`)
- **"Remove plan" now empties** instead of re-seeding (was calling `resetToSeed()`).
  (`src/pages/dashboard/Planner.tsx` `handleDeletePlan` → `replace({...empty})`)

### Not started (this handoff)
The redesign itself — increments below.

## Increments (build in order; each is independently deployable)

**Inc. 1 — Draft + preview + sleep control (NO chat).** The foundation and the no-AI path.
- Hold a `draft: ScheduleData` in local state (not the store).
- Live **week preview** of the draft (reuse the Week/DayPlanner render read-only, or a
  compact 7-day strip).
- New **"bedtime / wake" sleep control** (fixes the unintuitive 1am–10am case): frame as
  *deitar/acordar* with automatic cross-midnight detection + validation. Replaces the raw
  start→end window in `SleepEditDialog`.
- Entry: template / AI-generate / scratch (already seeds base categories).
- Manual category edit (`CategoryInput`, already de-sleeped).
- **Apply** → `onApply(draft)` → host `replace(draft)`.

**Inc. 2 — Visual chat editing the draft.**
- A chat panel (reuse `streamChatMessage` + `globalToolRegistry`) that proposes tool calls
  and **applies them to the draft**, not the live store.
- **Key architecture gap:** tools currently mutate the **live store**. Build a
  *draft-scoped executor* — run the same tool definitions against the draft
  `ScheduleData` (pure transforms), not `useSchedule()`. Then `Apply` commits the draft.
- Show the panel only when AI is usable; otherwise keep the manual/template flow.

**Inc. 3 — Week sleep + template variety.**
- Bring the new sleep render/edit to the **Week** page (`src/pages/dashboard/Week.tsx`).
- Genuinely rebalance template **workload** (today 8 intense / 5 moderate / 2 light) by
  adjusting block **density**, not just re-tagging `workload` (re-tagging would be
  dishonest). (`src/lib/schedule/templates.ts`)

## Target files
- `src/components/planner/PlannerBuilder.tsx` — the 654-line wizard to replace.
- `src/components/planner/PlannerForm.tsx`, `CategoryInput.tsx` — reusable inputs.
- `src/lib/schedule/templates.ts` — `SCHEDULE_TEMPLATES`, `createEmptySchedule`,
  exported `baseCategories()`; `ScheduleTemplate.workload`.
- `src/pages/dashboard/Planner.tsx` — host; `handleBuilderApply` → `replace()`; page
  states `builder | dashboard | applied | empty`.
- `src/components/dashboard/planner/SleepEditDialog.tsx` — sleep editor to redesign as
  bedtime/wake.
- `src/lib/schedule/sleep.ts` — `validateRoutineSleepOverlap` (sleep IS enforced on
  create/edit via `ScheduleService`; seed data bypassed it — keep that in mind for the draft).
- `src/lib/ai/chat/service.ts` + `src/lib/ai/tools/registry.ts` (`globalToolRegistry`) —
  chat + tools to scope to a draft.
- `src/pages/dashboard/Week.tsx` — Inc. 3.

## What worked
- **Draft → apply** is the right model (owner confirmed): non-destructive, discardable.
- Sleep enforcement already exists (`validateRoutineSleepOverlap`, default
  `enforceSleepBoundary: true`) and is wired into `ScheduleService` add/update — reuse it
  to validate the draft.
- The proxy-based AI (`gemini-local` → `GeminiProxyAdapter`) + graceful empty-state means
  "no AI" is a real, common path — the manual fallback is mandatory, not optional.

## What didn't work / gotchas
- **Tools mutate the live store**, so you can't naively reuse them for a draft — needs a
  draft-scoped executor (Inc. 2's main effort).
- **Preview server:** `.claude/launch.json` says port 4173 but **Vite serves on
  `http://127.0.0.1:8080`**. Use `127.0.0.1`, NOT `localhost` (IPv6 vs Vite's IPv4 →
  chrome-error). Full-page navigations are flaky; prefer in-app SPA clicks. Screenshots
  time out on three.js pages — use `preview_eval`/`preview_snapshot` (DOM/geometry).
- **Deploy:** Vercel auto-builds on push to `main`, but the **PWA service worker** caches
  the old app shell — after a deploy, cache-bust (DevTools → Application → Service Workers →
  Unregister + Clear site data) or it looks like the deploy didn't land.

## Next steps
1. Start **Inc. 1**: introduce a `draft` state in a new planner shell; wire template/scratch
   to seed it; add the week preview + the bedtime/wake sleep control; Apply → `replace`.
2. Then **Inc. 2** (draft-scoped tool executor + chat panel, gated on AI).
3. Then **Inc. 3** (Week sleep + honest template rebalance).

## Verify (every increment)
```bash
npx tsc --noEmit -p tsconfig.app.json   # must be 0 errors (NOT plain `tsc --noEmit`)
npx vitest run                          # 349 tests green
```
Smoke in preview at `http://127.0.0.1:8080` (guest login → /dashboard/planner).
