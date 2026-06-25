# Chronos — AGENTS.md

Use this file for fast, practical context. Prefer links for product/background details:
- Product and roadmap context: [README.md](README.md)

## Stack and tooling
- React 18 + TypeScript + Vite (SWC) + Tailwind 3 + shadcn/ui
- Package manager: pnpm via Corepack (`corepack pnpm install`)
- Key deps: @tanstack/react-virtual (timeline virtualization)
- Use pnpm lockfile as source of truth; ignore `package-lock.json`

## Commands
| Action | Command |
|---|---|
| Install | `corepack pnpm install` |
| Dev server | `corepack pnpm dev --host 127.0.0.1 --port 4173` |
| Build | `corepack pnpm build` |
| Build (dev mode) | `corepack pnpm build:dev` |
| Lint | `corepack pnpm lint` |
| Test all | `corepack pnpm test` |
| Test watch | `corepack pnpm test:watch` |

## Architecture map
- App entry: `src/main.tsx` -> `src/App.tsx`
- Routing: React Router v6, `/dashboard/*` routes wrapped by `RequireAuth`
- Auth: local fake auth in `src/lib/auth.tsx` (session key `chronos.session.v1`)
- Schedule state: `src/lib/schedule/store.tsx` (localStorage key `chronos.schedule.v3`, migrates older versions)
- Data types: `src/lib/schedule/types.ts` (`ScheduleData` v3)
- Planner UI hotspot: `src/components/dashboard/DayPlanner.tsx`
- Profile dialog hotspot: `src/components/dashboard/ProfileDialog.tsx` (carousel with multi-profile state `extraProfiles: (ScheduleData | null)[]`)
- Workspace system (replaced extensions): `src/lib/schedule/workspace-engine.ts` (templates, runtime)
  - Category owns structure (`category.workspace`), block owns runtime state (`block.workspace`)
  - Renderers: `TemplateEditor.tsx` (form-based list), `SessionView.tsx` (3-state dialog), `BlockSessionBadge.tsx` (timeline pill)
  - Presets: `src/workspaces/presets.ts` (workout, reading, study — data only)

## Project conventions
- Time math is string-based (`HH:mm`) with explicit `24:00` boundary handling in agenda generation
- Cross-day behavior is first-class:
	- `endsNextDay` may be inferred from `end <= start`
	- previous/next day segments are split around `00:00`/`24:00`
- Sleep is schedule-level metadata (`meta.sleepSchedule`, `meta.enforceSleepBoundary`), not normal routine blocks
- Drag/snapping behavior in planner assumes 15-minute increments

## Testing and quality
- Test runner: Vitest (`jsdom`, globals on)
- Tests live under `src/**/*.{test,spec}.{ts,tsx}`
- Test setup: `src/test/setup.ts`
- Use `@/` imports in tests and app code (alias configured in Vite + Vitest)
- **Type-check:** `npx tsc --noEmit -p tsconfig.app.json` (the bare `tsc --noEmit` is a **no-op** — the solution-style root tsconfig has `files: []` and only checks via project references)

## AI system (Aetheris)
- Connected to Gemini (default), OpenAI, Anthropic, OpenRouter (200+ models), or Ollama (local) via pluggable adapters in `src/lib/ai/core/adapters/`.
- Adapter pattern: `LLMProvider` interface in `provider.ts`. Registry in `registry.ts` handles discovery, fallback chains.
- Pipeline (`pipeline.ts`) is async — calls active provider with compressed ScheduleContext + system prompt, returns structured JSON.
- 11 heuristic simulation files (1,658 LOC) were deleted; ~65 infrastructure files remain under `src/lib/ai/` (note: `autonomy/` and `suggestions/index.ts` are dead and slated for removal).
- `VITE_GEMINI_API_KEY` in `.env` (gitignored) provides a default Gemini key for local dev. Not required — falls back to localStorage-stored keys.
- Fallback: if no key is configured, **Aetheris chat/analysis returns empty cards** (the heuristic engines were deleted). Only the **digest** still computes offline (8 heuristic modules). An honest "add a key" empty-state is planned.
- Aetheris page (`src/pages/dashboard/Aetheris.tsx`) is the central AI hub with 7 sidebar tabs: Insights, Suggestions, Recovery, Optimize, Proactive, Planner, Learning. Includes "Ask Aetheris" chat input at bottom.
- Planner and Learning page content embedded inline in Aetheris as sub-tabs. Standalone routes (`/dashboard/planner`, `/dashboard/learning`) still exist.
- Planner page (`src/pages/dashboard/Planner.tsx`) detects existing schedule on load and shows current-plan dashboard with View/Create New/Delete options instead of always starting from step 0.
- `CategoryInput` component (`src/components/planner/CategoryInput.tsx`) replaces all comma-separated text inputs with tag-based chips.
- 14 schedule templates in `templates.ts`: 10 productivity archetypes (Productivity, Balanced, Student, Deep Work, Recovery, Weekend Maker, Freelancer Flow, Early Bird, Night Owl, Shift Worker) + 4 creative domain templates that showcase the full model — **Barbershop** (clients as dated commitments + loose chores behind an upkeep goal), **Personal Trainer**, **Parent & Household**, **Musician** — each seeding flexible commitments + goals, not just routine blocks. Authoring rule for new templates: keep routine on weekdays 1–6 with dated commitments at globally non-overlapping times so `optimizeSchedule` stays conflict-free (regression-guarded by `template-ai-context.test.ts`).
- **Gemini schedule planner**: `src/lib/ai/planner/gemini-planner.ts` generates personalized ScheduleData from PlannerPreferences + LearningProfile, falling back to heuristic `generator.ts` if the API key is missing. **Wired into the planner form flow** (`Planner.tsx` → `generateGeminiProposals`, with heuristic fallback) and regression-tested (`gemini-planner.test.ts`).
- **OpenRouter adapter**: `src/lib/ai/core/adapters/openrouter.ts` — OpenAI-compatible adapter pointing to `openrouter.ai/api/v1`. Supports 200+ models (GPT-4o, Claude, Gemini, Llama) via a single API key. Registered in `registry.ts` and auto-displayed in AI Settings page.
- **Category tone fix**: `safeKindStyle(kind, categories)` in `widgets.tsx` now resolves custom category tones (sky, violet, coral, etc.) via `toneStyle` map instead of returning muted fallback. Updated in DayPlanner, Today, Focus, Week pages.

## Agent guardrails
- Do not introduce server/cloud assumptions unless explicitly requested; current app behavior is local-first
- Prefer focused edits in schedule core files (`DayPlanner`, `store`, `types`) when changing planner behavior
- Validate with targeted vitest runs for cross-day/sleep interactions after schedule logic changes
- **Checklist sync**: After every significant change, check the Development Checklist in `README.md` (under the "Development checklist" heading) and update checkbox state (`[ ]` / `[x]`) to reflect current reality. Never let the checklist drift out of date.
