# Chronos

Chronos is a personal productivity and routine-planning app built as a portfolio project.

It combines:
- weekly recurring routine blocks
- one-time commitments
- a daily planner focused on real schedule clarity
- local-first data storage
- JSON / XLSX / ICS export
- PT-BR / EN language toggle
- light / dark theme support

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- localStorage as the current persistence layer

## Running locally

### Requirements

- Node.js 20+
- pnpm available through Corepack

### Install dependencies

```bash
corepack pnpm install
```

### Start the dev server

```bash
corepack pnpm dev --host 127.0.0.1 --port 4173
```

Open:

- http://127.0.0.1:4173

### Production build

```bash
corepack pnpm build
```

## Data model

Chronos currently uses a local-first schedule model:

- `routine`: recurring weekly blocks
- `commitments`: one-time events that can override routine blocks on a specific date
- `categories`: editable block types
- `meta`: owner, workday bounds, cycle, and sleep window

The main local storage key is currently:

- `chronos.schedule.v2`

Legacy `v1` data is still read as a fallback and normalized into the current schema.

## Current behavior

- routine blocks are conflict-validated against other routine blocks
- commitments are conflict-validated against other commitments
- commitments can overlap routine blocks and visually override them in the daily agenda
- free time is rendered as virtual blocks in the daily planner and weekly routine grid
- sleep is handled as a first-class system category through `meta.sleepWindow`

## Important project files

- `src/lib/schedule/store.tsx`: local schedule model, persistence, conflict rules, agenda builders
- `src/components/dashboard/DayPlanner.tsx`: daily planner UI and drag flow
- `src/components/dashboard/widgets.tsx`: weekly routine grid and dashboard cards
- `src/pages/dashboard/Week.tsx`: weekly planning page
- `OVERHAUL.md`: implementation checklist and current overhaul status

## Notes

- the app is intentionally local-first for now
- suggestions are currently rule-based, not powered by a real LLM
- this README should be updated as the schedule model and dashboard behavior evolve
