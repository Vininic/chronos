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
- **Aetheris chat UI** — mid-rework; currently visually inconsistent / incomplete.

### 🐞 Known issues to fix
- **Digest is low-signal.** The AI path ignores the selected timeframe and custom date range (daily/weekly/monthly come out identical), always uses Gemini regardless of the chosen provider, and emits cards that are often inaccurate or not actionable. Needs prompt redesign + real per-timeframe scoping.
- **AI wastes tokens.** The system prompt is sent twice per call and the full schedule context is serialized into every chat message. Needs trimming / caching.
- **Fallback isn't really a fallback.** Without a key, Aetheris analysis returns empty cards (the heuristic engines were removed; only the digest still has them). Either restore a heuristic path or message the empty state honestly.
- **AI surface sprawl.** ~5 of 9 nav entries are AI-related; Audit History / AI Metrics / AI Settings should fold into the Aetheris hub.
- **Dead weight.** Remove the unused `@opencode-ai/sdk` dependency; collapse the two hourglass implementations into one; drop the orphaned `schedule.json` seed.

### 🗺️ Planned
- **Focus & Timer rework** — ✅ done: persistent sidebar **TimerCard** (above the profile), a single Focus-page hourglass, free-input duration + quick presets, and an inline session view (no modal). ⏳ Remaining cleanup: delete the now-unused `Hourglass3D` (three.js) and drop the `three` / `@react-three/*` dependencies.
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

138 tests across cross-day scheduling, goal-progress math, AI context building, prompt regression, and the workspace engine.

---

*Local-first by design; your schedule and keys never leave the browser unless you point the assistant at a provider.

---

## System readiness

### 🟢 Ship-ready (clean, tested, no known gaps)

| System | Size | Notes |
|---|---|---|
| **Schedule domain** (types, helpers, sleep, agenda, ledger, suggestions) | ~42 KB | Pure functions, zero framework deps |
| **Schedule services** (ScheduleService, Validator, Migrator) | ~38 KB | Clean architecture, fully extracted |
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
| **Today page** | 71 KB | Massive, no separation of concerns |
| **Week page** | 24 KB | Recently rewritten, needs iteration |
| **Focus page** | 24 KB | "Focus concept" unchecked in checklist |
| **Goal system** | ~30 KB | Works well, 44 tests pass |
| **Planner UI** (builder, merge, proposals) | ~80 KB | Gemini planner not wired into UI yet |
| **Chat UI** (Aetheris thread) | ~40 KB | "Mid-rework, visually inconsistent" |
| **Export** (JSON/XLSX/ICS) | 7 KB | Functional, no known bugs |
| **ComposeBlockDialog** | 29 KB | Functional, could use polish |
| **TimerCard** | 10 KB | Timer section rework unchecked |
| **Schedule templates** | 47 KB | AI displays false concerns — needs fixing |

### 🟠 Needs work (known gaps or missing pieces)

| System | Size | Issues |
|---|---|---|
| **AI Pipeline** (core/pipeline.ts) | 5.9 KB | Central orchestration — 0 tests |
| **AI Chat service** (chat/service.ts) | 13.4 KB | Prompt building, tool extraction — 0 tests |
| **AI Tools** (10 modules) | ~29 KB | Validation, safety, execution — 0 tests |
| **AI Learning** (learning/) | 13 KB | Recommutation logic — 0 tests |
| **AI Planner** (generator + gemini-planner) | ~33 KB | Heuristic + gemini generators — 0 tests |
| **AI Adapters** (5 providers) | ~19 KB | No mock or integration tests |
| **AI Context** (context/) | ~26 KB | Builder untested beyond basics |
| **AI Scheduling engine** (scheduler.ts) | 6 KB | All 7 rule checks — 0 tests |
| **AI Optimization** | 3.8 KB | 0 tests |
| **AI Autonomy** | 5.4 KB | 0 tests |
| **AI Pattern detection** | 3.8 KB | 0 tests |
| **AI Self-eval / Explainability** | ~5.2 KB | 0 tests |
| **Digest system** | ~31 KB | Low-signal, ignores timeframe, always Gemini |
| **Programs** | — | High priority, unstarted |
| **DayPlanner** | 130 KB | Largest file — needs splitting into grid + drag + blocks |

### 🔴 Not started / Should delete

| System | Size | Issues |
|---|---|---|
| **AI suggestions/index.ts** | 0 B | Empty placeholder |
| **Hourglass3D** (Three.js) | 17 KB | Unused — delete + drop three/react-three deps |
| **schedule.json** (root data/) | 5 KB | Orphaned stale seed — delete |
| **PWA / offline** | — | Not started |
| **Cloud sync** | — | Not started |
| **Push notifications** | — | Not started |

### 📋 Development checklist

From `checklist.md` — 7 items remaining:

- [ ] **Continue programs work** (high priority — needs scoping)
- [ ] **Timer section rework** — pop-up card above profile, relevant blocks, focus hourglass, "start section" integration
- [ ] **Improve Focus concept** — highlight focus blocks in category creator
- [ ] **Category color picker UI** — small lines on bottom visual oversight
- [ ] **Remove system-baked instances** — full modularity, no hard-coded categories/blocks
- [ ] **Fix schedule templates** — AI should not display false concerns, use sleep functions properly
- [x] **Move system to clean architecture** — ✅ done

### 🔜 Recommended next steps (in order)

1. **Split DayPlanner** (130 KB → grid + drag handler + block renderer + orchestration)
2. **Test AI core** — pipeline, chat service, at least one adapter contract test
3. **Close checklist** — fix high-impact unchecked items (programs, timer, templates)
4. **Fix digest** — respect provider choice, fix timeframe granularity, improve empty state
5. **Housekeeping** — delete Hourglass3D + three deps, orphaned schedule.json, empty suggestions/index.ts
6. **Update AGENTS.md** — stale reference to "line 340 of README.md"*
