---
name: crossday-schedule-safety
description: "Use when editing crossday scheduling, midnight splitting, drag-resize timeline behavior, sleep boundaries, or agenda generation in Chronos. Enforces safety checks and regression validation."
argument-hint: "Describe the crossday or sleep-boundary change to make safely"
user-invocable: true
---

# Crossday Schedule Safety

Guardrail workflow for Chronos planner changes touching cross-midnight behavior.

Use this skill when work involves:
- crossday routine or commitment rendering
- drag/resize behavior around 00:00 or 24:00
- sleep-boundary enforcement and timeline clamping
- agenda segmentation or overlap subtraction

## Source-of-Truth Files

- `src/lib/schedule/store.tsx`
- `src/components/dashboard/DayPlanner.tsx`
- `src/lib/schedule/types.ts`
- `src/test/schedule-crossday.test.ts`
- `AGENTS.md`
- `README.md`

## Safety Invariants

- Preserve explicit `24:00` and `00:00` boundary semantics.
- Keep crossday inference consistent: `endsNextDay` may be inferred from `end <= start`.
- Treat sleep as schedule-level metadata, not standard routine blocks.
- Do not break visibility of previous-day spillover blocks after midnight.
- Keep drag snapping and timeline math aligned to 15-minute increments.

## Procedure

1. Identify whether the bug/change is in data derivation (`store.tsx`) or interaction/rendering (`DayPlanner.tsx`).
2. Make the smallest change that preserves existing boundary invariants.
3. If behavior changes, update or add targeted assertions in `src/test/schedule-crossday.test.ts`.
4. Run focused validation:
   - `corepack pnpm test -- src/test/schedule-crossday.test.ts`
5. Run broader safety checks:
   - `corepack pnpm test`
   - `corepack pnpm lint`
6. If timeline logic changed significantly, run build confirmation:
   - `corepack pnpm build`

## Output Checklist

Report:
- what boundary rule changed
- which invariant(s) were preserved
- which tests were run and results
- any known edge cases left intentionally unchanged
