# Chronos

**A visual, routine-first day planner with a real LLM scheduling assistant.**

React + TypeScript · local-first · bring-your-own-key AI

Chronos treats a week as *architecture* rather than a flat to-do list. You define recurring **routine blocks** (deep work, training, study, recovery, sleep) and layer one-off **commitments** on top — without destroying the routine underneath. A conversational assistant, **Aetheris**, can read the whole schedule and propose or apply changes through a guarded tool layer.

> This is a solo portfolio project. It is intentionally **deep in a few places** — the timeline engine and the AI integration — rather than broad and shallow. The roadmap near the bottom is honest about what is polished, what is rough, and what isn't built yet.

---

## What this project demonstrates

- **Non-trivial domain modeling** — a ~1.8k-line schedule store with cross-midnight blocks, per-day sleep windows, date-specific sleep cuts, live collision cascades, and versioned data migrations.
- **A real AI integration, not a thin wrapper** — a provider abstraction over Gemini / OpenAI / Anthropic / OpenRouter / Ollama, streaming chat, function-calling behind a safety/guardrail layer, plus an audit log with per-action undo.
- **Test discipline** — 138 unit tests (Vitest) over the scheduling and AI-context logic; clean `tsc --noEmit`.
- **Design sensibility** — a calm, dense, Linear/Arc-influenced UI on Radix + shadcn/ui + Tailwind.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18, TypeScript, Vite |
| UI | Tailwind CSS, Radix UI / shadcn/ui, lucide-react |
| State | React context + `localStorage` (local-first) |
| AI | `@google/generative-ai` + a custom multi-provider layer |
| Testing | Vitest, Testing Library |

---

## Features (built)

**The planner — the core of the product**
- Recurring weekly routine blocks + one-off commitments that override routine without erasing it
- Drag / resize / split / merge with a live push-down collision cascade (preview matches commit)
- Cross-midnight blocks with stable overflow rendering
- Per-day sleep windows, independent wake/bedtime, and date-specific sleep cuts

**Goals & progression**
- Count / duration / numeric / deadline goals on a validated `kind × tracking × period` matrix
- Category auto-tracking, streaks, period-aware progress, weekly/monthly rollups

**Category workspaces**
- A category can own a structured "session" template (workout / reading / study) rendered by a **generic** engine — no per-domain code; presets are just data. Deleting every preset doesn't break the app.

**Aetheris (AI assistant)**
- Conversational, streaming chat grounded in the live schedule
- Function-calling (create/move/delete blocks, commitments, goals, notes…) behind overlap / sleep / protected-deletion guards
- Audit history + per-action undo
- Autonomy slider: conservative (suggest only) → balanced → aggressive (auto-apply)
- Bring-your-own-key, multiple providers, graceful behavior when no key is set

**Daily Digest**
- Report cards (recovery, burnout, productivity, consistency, opportunities…) generated heuristically, with an optional AI pass

---

## Architecture

```
src/
├─ lib/schedule/   # domain core: types, store, cross-day + sleep engine, migrations
├─ lib/ai/         # context builder, provider adapters, tool registry, pipeline, chat, learning
├─ lib/digest/     # heuristic report modules + AI generator
├─ components/     # DayPlanner, dialogs, sidebar, chat, digest, goals
└─ pages/dashboard/# Today, Week, Focus, Aetheris, Planner, Settings
```

Design rule: **the category owns structure, the block owns runtime state, renderers are generic.** There is no plugin/extension system — that was deliberately removed in favor of data-driven category workspaces.

The genuinely hard part lives in `lib/schedule/store.tsx`: normalizing cross-midnight intervals into per-day segments, enforcing sleep boundaries mid-drag, and keeping the drag *preview* cascade byte-for-byte identical to the committed result.

---

## Running locally

Requirements: **Node 20+**, **pnpm** via Corepack.

```bash
corepack pnpm install
corepack pnpm dev --host 127.0.0.1 --port 4173   # → http://127.0.0.1:4173
corepack pnpm build                               # production build
corepack pnpm test                                # run the 138-test suite
```

AI features degrade gracefully without a key. To use the assistant:

- **Local dev:** put `VITE_GEMINI_API_KEY` in `.env` (gitignored).
- **Any provider:** enter your own key in **Settings → AI** (stored in `localStorage`, sent only to that provider). OpenRouter is the easiest way to reach many models with one key.

| Provider | API key | Streaming | Function calling |
|---|---|---|---|
| Gemini (default) | env or BYO | ✅ | ✅ |
| OpenAI | BYO | ✅ | ✅ |
| Anthropic | BYO | ✅ | ✅ |
| OpenRouter | BYO | ✅ | ✅ |
| Ollama (local) | none | ✅ | ❌ |

> Keys live only in `localStorage` / your `.env`. With a build-time `VITE_*` var, Vite inlines it into the bundle — for any public deploy, prefer the in-app BYO-key flow.

---

## Status, known issues & roadmap

Honest status for a project still under active development. The planner core is solid; the AI periphery is where the rough edges are.

### 🔧 In progress
- **Aetheris chat UI** — ✅ redesigned into one visual language: assistant turns render in a bronze-spined "Aetheris" frame, every tool-call state (proposed / applied / error / undone) shares a single `ActionLedger` component, and the markdown renderer now supports correct heading order, links, and code. Remaining polish tracked under digest below.

### 🐞 Known issues to fix
- **Digest signal.** The AI path now scopes per timeframe and respects the selected provider, and false cross-day "overlap" cards are filtered out (shared `validateConflictClaims` guard). Card copy can still be hit-or-miss — prompt quality is the remaining work.
- **AI wastes tokens.** ✅ Fixed — the system prompt is no longer sent twice (the duplicate copy was removed from the prompt body; it's delivered once via the provider's system channel). Per-message context caching remains a smaller optimization.
- **Fallback isn't really a fallback.** ✅ Fixed — without a key, the Aetheris analysis surface now shows an honest "AI analysis is unavailable — add an API key in AI Settings" call-to-action instead of a misleading "No issues detected".
- **AI surface sprawl.** The AI subsystem is still large (~60 files), but the navigation is **already consolidated**: only 2 of 7 sidebar entries are AI (Aetheris, Planner). Audit History + AI Metrics render as tabs *inside* the Aetheris hub, and AI Settings lives in the Settings page. Remaining work is pruning dead modules (done: `autonomy/`, `suggestions/`, orphaned `AISettings.tsx`), not nav.
- **Dead weight.** ✅ Done — deleted the dead `src/lib/ai/autonomy/` module (zero imports), the empty `src/lib/ai/suggestions/index.ts`, the orphaned `src/data/schedule.json` seed, the legacy `package-lock.json`, and the orphaned `src/pages/dashboard/AISettings.tsx`. (`@opencode-ai/sdk` was already gone.)

### 🗺️ Planned
- **Focus & Timer rework** — ✅ done: persistent sidebar **TimerCard** (above the profile), free-input duration + quick presets, and an inline session view (no modal). **Two hourglasses by design:** the 3D `Hourglass3D` (three.js) powers the Focus page, Login, and Landing hero; the lightweight SVG `MiniHourglass` lives inside the TimerCard. `three` / `@react-three/*` stay — they are not dead weight.
- **Week / Month views** — redesign; decide whether the drag system extends there. Move "weekly" stats out of Today.
- **Landing page** — full redesign.
- **Smaller polish** — category reordering; smarter time-search on block create/edit (e.g. typing `4` surfaces 4 AM/4 PM); top-left card spacing; footer rendering; remove any remaining hard-coded seed instances so the system is fully data-driven.

### 🔭 Future (not started)
- PWA / offline / mobile layouts · cloud sync (Supabase) · push notifications · cross-device continuity.

---

## Tests

```bash
corepack pnpm test
```

**305 tests** across the schedule domain, goal-progress math (44), AI context + chat-prompt, the full AI core (pipeline, tools, safety, scheduler, gemini, adapters, learning, pattern), digest, export, schedule services, prompt regression, planner constraints/drag, and the workspace engine.

---

*Local-first by design; your schedule and keys never leave the browser unless you point the assistant at a provider.

---

## System readiness

### 🟢 Ship-ready (clean, tested, no known gaps)

| System | Size | Notes |
|---|---|---|
| **Schedule domain** (types, helpers, sleep, agenda, ledger, suggestions) | ~42 KB | Pure functions, zero framework deps |
| **Schedule services** (ScheduleService, Validator, Migrator) | ~38 KB | Clean architecture; Validator + Migrator tested (`schedule-services.test.ts`) |
| **Schedule React adapter** (store.tsx) | 440 lines | Thin wiring layer, all logic delegated |
| **Repository port + impl** (LocalStorage) | ~1.6 KB | Interface + impl, swappable |
| **Auth** (local fake) | 1.7 KB | Simple, stable |
| **Theme** (next-themes) | 2.1 KB | Standard wrapper |
| **I18n** (pt/en) | ~74 KB | Full dictionaries |
| **Keyboard shortcuts** | 3.6 KB | Rebindable system |
| **Workspace engine + presets** | ~31 KB | Solid, tested (13 tests) |
| **Build / dev infra** | configs | Vite + SWC, pnpm, Vitest, Tailwind, shadcn |

### 🟡 Needs polish (functional, has issues)

| System | Size | Issues |
|---|---|---|
| **Today page** | 71 KB | Massive — 8 components in one file + an inline `BlockTypeGallery` category editor (~380 lines); weekly stats already moved out |
| **Week page** | 24 KB | Recently rewritten, needs iteration |
| **Focus page** | 24 KB | Focus concept shipped — categories badge + toggle focus blocks in the creator |
| **Goal system** | ~30 KB | Works well, 44 tests pass |
| **Planner UI** (builder, merge, proposals) | ~80 KB | Gemini planner wired into the form flow; falls back to heuristics with no key — regression-tested |
| **Chat UI** (Aetheris hub) | ~128 KB | `Aetheris.tsx` (52 KB) + `components/chat/*` + `components/digest/*`; unified `ActionLedger`, Aetheris frame, richer markdown |
| **Export** (JSON/XLSX/ICS) | 7 KB | ✅ Tested — pure builders (`buildICS` / `buildScheduleWorkbook` / `serializeScheduleJSON`) covered by `export.test.ts` |
| **ComposeBlockDialog** | 29 KB | Functional, could use polish |
| **TimerCard** | 10 KB | Done — persistent sidebar card, idle/active/session states, render-tested |
| **Schedule templates** | 47 KB | False AI concerns (phantom sleep debt + cross-day overlap) fixed & regression-tested |

### 🟠 Needs work (known gaps or missing pieces)

| System | Size | Issues |
|---|---|---|
| **AI Pipeline** (core/pipeline.ts) | 5.9 KB | ✅ autonomy filter tested (`ai-pipeline.test.ts`) |
| **AI Chat service** (chat/service.ts) | 13.4 KB | ✅ tool extraction + prompt build tested; token-waste fixed (system prompt sent once) |
| **AI Tools** (10 modules) | ~29 KB | ✅ registry, safety, block/goal execution tested (`ai-tools` + `ai-safety-scheduler`) |
| **AI Learning** (learning/) | 13 KB | ✅ persistence + pattern detection tested (`ai-learning-pattern.test.ts`) |
| **AI Planner** (generator + gemini-planner) | ~33 KB | ✅ heuristic + gemini paths tested (`gemini-planner.test.ts`) |
| **AI Adapters** (5 providers) | ~19 KB | ✅ OpenAI contract test w/ mocked fetch (`ai-adapters.test.ts`) |
| **AI Context** (context/) | ~26 KB | ✅ ~46 tests (`ai-context` + `template-ai-context`) — well covered |
| **AI Scheduling engine** (scheduler.ts) | 6 KB | ✅ all 7 rule checks tested (`ai-safety-scheduler.test.ts`) |
| **AI Optimization** | 3.8 KB | ✅ exercised via `template-ai-context.test.ts` |
| **AI Pattern detection** | 3.8 KB | ✅ tested (`ai-learning-pattern.test.ts`) |
| **AI Self-eval / Explainability** | ~5.2 KB | ✅ tested (`ai-pipeline` + `prompt-regression`) |
| **Digest system** | ~31 KB | ✅ provider-aware + per-timeframe; 8 heuristic modules tested (`digest.test.ts`); prompt quality is the remaining gap |
| **DayPlanner** | 130 KB | ⏳ Largest file — still to split into grid + drag + blocks |

### 🔴 Not started / Should delete

| System | Size | Issues |
|---|---|---|
| **AI suggestions/index.ts** | 0 B | Empty placeholder — delete |
| **AI Autonomy** (`autonomy/`) | 5.4 KB | Dead code — zero imports anywhere; delete |
| **schedule.json** (`src/data/`) | 5 KB | Orphaned stale seed — delete (store imports only `-en`/`-pt`) |
| **package-lock.json** | — | Legacy lockfile — delete (pnpm is canonical) |
| **PWA / offline** | — | Not started |
| **Cloud sync** | — | Not started |
| **Push notifications** | — | Not started |

### 📋 Development checklist

From `checklist.md`:

- [ ] **Continue programs work** (high priority — needs scoping)
- [x] **Timer section rework** — ✅ done: sidebar TimerCard above profile, relevant blocks, focus hourglass, session integration
- [x] **Improve Focus concept** — ✅ done: per-category Focus badge + inline toggle in the category creator (writes `meta.focusCategoryIds`)
- [ ] **Category color picker UI** — small lines on bottom visual oversight
- [ ] **Remove system-baked instances** — full modularity, no hard-coded categories/blocks
- [x] **Fix schedule templates** — ✅ done: AI no longer shows false sleep-debt / cross-day-overlap concerns; sleep is structural
- [x] **Move system to clean architecture** — ✅ done
- [x] **Fix type foundation** — ✅ `tsc -p tsconfig.app.json` green (4 errors → 0)
- [x] **Test the AI core** — ✅ +126 contract tests → **305 total** (safety, scheduler, tools, pipeline, gemini, adapters, learning, pattern, digest, export, services, stores)
- [x] **Honest AI empty-state** — ✅ no-key CTA on the Aetheris analysis surface (no fake "all clear")
- [x] **Trim dead code** — ✅ deleted `autonomy/`, empty `suggestions/`, orphaned `schedule.json` + `AISettings.tsx`, legacy `package-lock.json`
- [x] **Creative schedule templates** — ✅ added 4 domain templates (Barbershop, Personal Trainer, Parent & Household, Musician) that showcase flexible commitments + goals + loose obligations, not just routine blocks

### 🔜 Recommended next steps (in order)

1. ✅ **Fix type foundation** — done (`tsc` 4 errors → 0)
2. ✅ **Test AI core** — done: +126 contract tests → **305 total** (pipeline, chat, tools, safety, scheduler, adapters, digest, export, services, stores)
3. ✅ **Honest empty-state** — done: no-key CTA on the Aetheris analysis surface
4. ✅ **Housekeeping** — done: dead code deleted (`autonomy/`, `suggestions/`, `schedule.json`, `package-lock.json`, orphaned `AISettings.tsx`); **kept** Hourglass3D (in use)
5. ✅ **Update AGENTS.md** — done
6. ⏳ **Split DayPlanner** (130 KB → grid + drag handler + block renderer + orchestration) — next up
7. ⏳ **Close checklist** — programs work, category color picker, remove system-baked instances
8. ⏳ **Digest prompt quality** — the one remaining digest gap
9. 🔭 **PWA · cloud sync · push notifications** — not started (future build)
