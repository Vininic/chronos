# Chronos

**A visual, routine-first day planner with a real LLM scheduling assistant.**

React + TypeScript · local-first · optional cloud sync · bring-your-own-key (or hosted) AI

Chronos treats a week as *architecture* rather than a flat to-do list. You define recurring **routine blocks** (deep work, training, study, recovery, sleep) and layer one-off **commitments** on top — without destroying the routine underneath. A conversational assistant, **Aetheris**, can read the whole schedule and propose or apply changes through a guarded tool layer.

> A solo portfolio project, intentionally **deep in a few places** — the timeline engine and the AI integration — rather than broad and shallow.

---

## What this project demonstrates

- **Non-trivial domain modeling** — a schedule core with cross-midnight blocks, per-day sleep windows, date-specific sleep cuts, live collision cascades, and versioned data migrations.
- **A real AI integration, not a thin wrapper** — a provider abstraction over Gemini / OpenAI / Anthropic / OpenRouter / Ollama, streaming chat, function-calling behind a safety/guardrail layer, plus an audit log with per-action undo.
- **A real backend, opt-in** — Supabase Postgres with row-level security, email auth, a generic `user_data` sync engine, realtime cross-device convergence, and a secure server-side AI proxy (the key never ships in the bundle).
- **Test discipline** — **349 unit tests** (Vitest) over the scheduling and AI logic; clean `tsc --noEmit -p tsconfig.app.json`.
- **Design sensibility** — a calm, dense, Linear/Arc-influenced UI on Radix + shadcn/ui + Tailwind.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18, TypeScript, Vite |
| UI | Tailwind CSS, Radix UI / shadcn/ui, lucide-react, Three.js (R3F) |
| State | React context + `localStorage` (local-first) |
| Backend (optional) | Supabase — Postgres + RLS, auth, realtime, Edge Functions |
| AI | Multi-provider layer (Gemini / OpenAI / Anthropic / OpenRouter / Ollama) |
| PWA | `vite-plugin-pwa` (installable, offline app shell) |
| Testing | Vitest, Testing Library |

---

## Features

**The planner — the core of the product**
- Recurring weekly routine blocks + one-off commitments that override routine without erasing it
- Drag / resize / split / merge with a live push-down collision cascade (preview matches commit)
- Cross-midnight blocks with stable overflow rendering
- Per-day sleep windows, independent wake/bedtime, and date-specific sleep cuts

**Goals & progression**
- Count / duration / numeric / deadline goals on a validated `kind × tracking × period` matrix
- Category auto-tracking, streaks, period-aware progress, weekly/monthly rollups

**Category workspaces**
- A category can own a structured "session" template (workout / reading / study) rendered by a **generic** engine — no per-domain code; presets are just data.

**Aetheris (AI assistant)**
- Conversational, streaming chat grounded in the live schedule
- Function-calling (create/move/delete blocks, commitments, goals, notes…) behind overlap / sleep / protected-deletion guards
- Audit history + per-action undo; autonomy slider (suggest only → balanced → auto-apply)
- Bring-your-own-key across providers, **or** a secure hosted Gemini proxy; honest empty-state when no AI is configured

**Profiles, sync & platform**
- **Local guest** (just a name) — data stays in the browser — or a **cloud account** (email/password) that syncs across devices
- Opt-in Supabase sync for schedule + learning/chat/digests/settings, with realtime cross-device convergence
- Installable PWA with offline support; Web Push scaffold (Edge Function + VAPID)

**Daily Digest**
- Report cards (recovery, burnout, productivity, consistency, opportunities…) generated heuristically, with an optional AI pass

---

## Architecture

```
src/
├─ lib/schedule/   # domain core: types, store, cross-day + sleep engine, migrations, repository ports
├─ lib/ai/         # context builder, provider adapters, tool registry, pipeline, chat, learning
├─ lib/supabase/   # client + cloud schedule repository
├─ lib/sync/       # generic user_data sync engine (debounced push, realtime, key carve-out)
├─ lib/digest/     # heuristic report modules + AI generator
├─ components/dashboard/planner/  # split DayPlanner: TimelineGrid, TimelineBlock, drag hook, dialogs
└─ pages/dashboard/# Today, Week, Focus, Aetheris, Planner, About, Settings
supabase/
├─ migrations/     # 0001 schema (user_data, push_subscriptions, RLS) · 0002 ai-proxy rate limit
└─ functions/      # ai-proxy (secure Gemini proxy) · notify (Web Push)
```

Design rule: **the category owns structure, the block owns runtime state, renderers are generic.** The genuinely hard part lives in `lib/schedule/store.tsx` and `components/dashboard/planner/` — normalizing cross-midnight intervals into per-day segments, enforcing sleep boundaries mid-drag, and keeping the drag *preview* cascade byte-for-byte identical to the committed result.

---

## Running locally

Requirements: **Node 20+**, **pnpm** via Corepack.

```bash
corepack pnpm install
corepack pnpm dev      # → http://localhost:8080
corepack pnpm build    # production build
corepack pnpm test     # run the 349-test suite
```

The app runs fully offline against `localStorage` with **no configuration**. Cloud sync and AI are optional add-ons (below).

### AI providers

The assistant degrades gracefully without AI: chat shows a clear "add an API key" state and analysis shows an honest "AI unavailable" card.

| Provider | Client key | How |
|---|---|---|
| **Gemini (Hosted)** | none | Routes through the `ai-proxy` Edge Function; the key is a **server secret**, never in the bundle |
| Gemini / OpenAI / Anthropic / OpenRouter | BYO | Paste your key in **Settings → AI** (stored in `localStorage`, sent only to that provider) |
| Ollama (local) | none | Point at a local Ollama server |

> **Keys never leave your device.** BYO keys live only in `localStorage` and are stripped before any cloud sync. The hosted option keeps the shared key server-side in Supabase — it is **never** exposed as a `VITE_*` variable (those get inlined into the bundle).

---

## Deploy

The frontend is a static SPA; all backend capability is Supabase, so the static host is a DX choice (Vercel recommended; Cloudflare Pages works with `public/_redirects`).

Full setup — provisioning the project, applying `supabase/migrations/*`, enabling email auth, configuring env, and deploying the `ai-proxy` / `notify` Edge Functions — is documented in **[docs/SUPABASE.md](docs/SUPABASE.md)**.

Client build env (safe to expose): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the VAPID **public** key. Server secrets (`GEMINI_API_KEY`, `service_role`, VAPID **private**) live only as Supabase Edge Function secrets.

---

## Project status

The planner core and the AI integration are the deep, tested parts. The data layer (local-first store, repository ports, optional Supabase sync with RLS) is in place; the AI runs against any provider you bring or a secure hosted proxy. Remaining work is product breadth (Week/Month redesigns, digest prompt quality) and the operational polish of self-hosting the backend — not core stability.

```bash
corepack pnpm test   # 349 tests across schedule domain, goal math, AI core, digest, export, sync, planner
```

---

*Local-first by design: your schedule lives in the browser. Cloud sync is opt-in and per-account; AI keys never leave your device.*
