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
- Schema-driven block data engine: `src/lib/extensions/` — generic `SchemaField` system, no per-use-case extensions
  - Core files:
    - `src/lib/extensions/schema.ts`: `SchemaField` types, defaults, progress, summary, type cycling, label→name
    - `src/lib/extensions/runtime.ts`: execution state helpers (getValues, setValues, updateValue, getCheckedItems)
    - `src/lib/extensions/migration.ts`: auto-migrate old `structured-notes` → `schema-data`, legacy `CustomField[]` → `SchemaField[]`
    - `src/lib/extensions/registry.ts`: simplified `ExtensionIdentity` (id, label, icon — no renderers since all rendering comes from schema)
    - `src/lib/extensions/types.ts`: `SchemaField`, `SchemaFieldType`, `CategoryTemplate`, `CategoryRule`, `ExecutionState`
  - Category owns structure (schema, templates, rules on `Category`), block owns execution state (`extensions["schema-data"]`)
  - No per-use-case Extension files (workout.tsx, checklist.tsx removed)
  - Three-layer display (Summary→QuickAccess→Workspace) in `src/components/dashboard/BlockSchemaUI.tsx`
  - Layer 1: `SchemaSummary` — compact badge in DayPlanner blocks
  - Layer 2: `SchemaQuickAccess` — editable form on block click
  - Layer 3: `SchemaWorkspace` — full sheet view (pending wire-up)
  - Legacy `CustomField` type deprecated, old `structured-notes` format migrated automatically

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

## Agent guardrails
- Do not introduce server/cloud assumptions unless explicitly requested; current app behavior is local-first
- Prefer focused edits in schedule core files (`DayPlanner`, `store`, `types`) when changing planner behavior
- Validate with targeted vitest runs for cross-day/sleep interactions after schedule logic changes
- **Checklist sync**: After every significant change, check the Development Checklist in `README.md` (starts at line 340) and update checkbox state (`[ ]` / `[x]`) to reflect current reality. Never let the checklist drift out of date.
