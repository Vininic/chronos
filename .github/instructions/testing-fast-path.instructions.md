---
description: "Use when validating Chronos changes quickly before commit, especially schedule, planner, or UI edits. Includes fast lint/test/build paths and targeted crossday checks."
name: "Chronos Testing Fast Path"
---
# Chronos Testing Fast Path

Run the smallest reliable check first, then expand only if needed.

## Quick Command Matrix

- Install deps (if needed): `corepack pnpm install`
- Lint only: `corepack pnpm lint`
- Full tests: `corepack pnpm test`
- Watch tests: `corepack pnpm test:watch`
- Production build: `corepack pnpm build`

## Fast Validation Flow

1. If you changed only styles/markup in one component:
   - Run `corepack pnpm lint`
2. If you changed schedule logic, date math, drag behavior, or sleep boundary logic:
   - Run `corepack pnpm test -- src/test/schedule-crossday.test.ts`
   - Then run `corepack pnpm test`
3. If you changed routing, providers, or shared state behavior:
   - Run `corepack pnpm lint`
   - Run `corepack pnpm test`
4. Before handing off major edits:
   - Run `corepack pnpm lint`
   - Run `corepack pnpm test`
   - Run `corepack pnpm build`

## Areas That Require Targeted Crossday Coverage

- `src/components/dashboard/DayPlanner.tsx`
- `src/lib/schedule/store.tsx`
- `src/lib/schedule/types.ts`

When any of these change, include the targeted crossday test command before full-suite execution.
