# Chronos — The Art of Time

Chronos is a persistent temporal operating system powered by structured routines, intelligent overrides, and adaptive planning.

Unlike traditional calendars, to-do apps, or productivity trackers, Chronos is built around a different philosophy:

> Time should be architected, not merely scheduled.

---

# What is Chronos?

Chronos is a visual chronological planner centered around recurring routine blocks and intelligent temporal organization.

The system is designed to help users build:
- sustainable routines
- intentional structure
- balanced schedules
- adaptive planning systems

Instead of focusing on isolated tasks, Chronos focuses on temporal architecture.

---

# Core Philosophy

Chronos is not:
- a generic task manager
- a simple calendar
- a productivity checklist
- a traditional planner

Chronos is:
- a persistent routine engine
- a chronological planning system
- a temporal override framework
- an adaptive scheduling assistant

The goal is not maximizing productivity at all costs.

The goal is creating sustainable, intentional structure.

---

# Core System

## Routine Blocks

Routine blocks are recurring weekly structures.

They define the backbone of the user's schedule:
- deep work
- workouts
- study
- rituals
- recovery
- meetings
- sleep

Every Monday can maintain the same structure.
Every Tuesday can preserve recurring routines.

These blocks represent temporal identity and consistency.

---

## Commitments

Commitments are punctual overrides.

They temporarily replace routine structure on a specific date and time without destroying the original routine underneath.

Examples:
- appointments
- exams
- interviews
- events
- deadlines
- travel

The base routine always remains intact.

---

# The Dayplanner

The dayplanner is the core of Chronos.

This is the primary feature and the main value proposition of the project.

The planner is built around:
- visual chronological blocks
- drag & resize interactions
- collision resolution
- cross-day continuity
- adaptive timeline rendering
- temporal consistency

The experience should feel:
- smooth
- intentional
- premium
- structurally coherent

---

# Cross-Day Timeline Logic

Chronos supports blocks that cross midnight.

Examples:
- overnight work
- late study
- recovery periods
- sleep
- extended sessions

Cross-day functionality should:
- remain visually stable
- avoid ghost boundaries
- preserve timeline consistency
- maintain valid durations
- normalize overflow behavior

Cross-day systems should only activate when timeline boundaries explicitly allow overflow behavior.

---

# AI Planning Layer

The AI system is one of the main differentiators of Chronos.

The AI should function as an adaptive planning assistant capable of:
- suggesting improvements
- balancing schedules
- detecting overload
- preserving recovery time
- reorganizing blocks
- generating commitments
- adapting routines dynamically

---

## AI Autonomy Levels

Planned autonomy system:

### Conservative
- suggestions only
- no automatic changes

### Balanced
- reorganizes low-impact blocks
- resolves small conflicts

### Aggressive
- fully restructures schedules
- aggressively optimizes routines

The user should control how much freedom the AI has.

---

# Goals & Progression

Chronos is evolving beyond scheduling into a progression-aware system.

Blocks should support:
- goals
- streaks
- metrics
- deadlines
- progress accumulation

Examples:
- 0/10 sessions
- 14h/40h study
- weekly streaks
- delivery deadlines
- accumulated metrics

Each block instance should contribute to long-term progression.

---

# Category Workspaces (Structured Context)

Workspace support is driven by Workspace Definitions (presets) that the planner reads as data, not code.

The project should avoid hardcoded feature-specific implementations.

---

# Local-First Philosophy

Chronos currently prioritizes local-first architecture:
- instant interactions
- offline usability
- local persistence

However, future versions will likely require optional cloud infrastructure for:
- sync between devices
- backups
- mobile continuity
- notifications
- cross-platform persistence

---

# Planned Platform Expansion

## Mobile & PWA

Planned features:
- installable PWA
- offline support
- mobile planner layouts
- smart notifications
- current/next block widgets
- daily agenda overlays

---

## Cloud Sync

Potential future stack:
- Supabase
- PostgreSQL
- realtime sync
- authentication

The goal is not enterprise complexity.

The goal is seamless continuity between devices.

---

# Design Philosophy

Chronos should feel:
- cinematic
- structured
- modern
- premium
- calm
- intentional

Inspirations:
- Linear
- Arc
- Raycast
- Vercel
- Read.cv

The product should prioritize:
- clarity
- motion
- typography
- hierarchy
- spatial consistency

---

# Long-Term Vision

Chronos aims to become:

> an operating system for intentional time architecture.

The project should remain focused on:
- temporal structure
- adaptive planning
- intelligent scheduling
- premium user experience

Not:
- a bloated productivity suite
- a generic task manager
- a feature-heavy super app

The planner itself is the product.

---

# Running locally

## Requirements

- Node.js 20+
- pnpm available through Corepack

## Install dependencies

```bash
corepack pnpm install
```

## Start the dev server

```bash
corepack pnpm dev --host 127.0.0.1 --port 4173
```

Open:

- http://127.0.0.1:4173

## Production build

```bash
corepack pnpm build
```

---

# Data model

Chronos currently uses a local-first schedule model:

- `routine`: recurring weekly blocks
- `commitments`: one-time events that can override routine blocks on a specific date
- `categories`: editable block types
- `meta`: owner, workday bounds, cycle, and sleep window

The current persistence layer is localStorage-based.

Future versions may introduce optional cloud synchronization while preserving local-first behavior.

---

# Development Checklist

# Core Product Identity

## Product Philosophy
- [x] Persistent temporal structure system
- [x] Weekly routine-based architecture
- [x] Commitment override system
- [x] Chronological visual planner
- [x] Local-first philosophy
- [ ] Fully refined temporal operating system identity
- [ ] Cohesive premium product direction
- [ ] Finalized product positioning

---

# Core Dayplanner

## Timeline Engine
- [x] Routine blocks
- [x] Commitments
- [x] Weekly recurring structure
- [x] Drag interactions
- [x] Resize interactions
- [x] Collision handling
- [x] Cross-day support

---

## Planner Refinement
- [x] Refactor cross-day logic
- [x] Separate normal drag and cross-day drag systems
- [x] Remove ghost sleep boundaries
- [x] Stabilize overflow rendering
- [x] Fix invisible drag states
- [x] Normalize overflow validation
- [x] Polish cross-day drag limit badges ("mins into next day" / "lower limit" and inverted upper-limit state) to avoid clutter at the 12:00AM boundary and conflicts with dragged blocks and the no-sleep-hours control
- [x] Refactor no-sleep-hours control copy: clarify that edits apply to the selected day and replace awkward "keep sleep hours" wording
- [x] Refactor no-sleep-hours behavior: make sleep start and wake time independent (including wake-only mode where day ends at 12:00AM)
- [x] Integrate sleep-break editing into the same no-sleep-hours control flow
- [x] Keep wake/bedtime controls always visible in fixed lanes with fallback labels
- [x] Keep wake and bedtime divider lines visually consistent
- [x] Match sleep-break edit affordance with normal block edit style
- [x] Improve compression logic (preview cascade matches commit cascade)
- [x] Refine collision behavior (push-down cascade during drag preview)
- [x] Improve timeline snapping (15-min visual guides, clockTimeFromMin/snapTime consistency)
- [x] Smooth drag interactions (pointer events, setPointerCapture, release easing)
- [x] Reduce visual jitter (GPU-composited translate3d, stable memo deps)
- [x] Improve timeline rendering performance
- [x] Timeline virtualization
- [x] Better overflow transitions
- [x] Responsive timeline max-height (adapts to viewport via ResizeObserver)
- [x] Unified time selection combobox (Command+Popover) replacing flat Select / native inputs
- [x] Focus card: user-picks-focus-category via Settings; blank state prompts to pick one
- [x] Focus page: also uses user-picked focus category; blank state when unset
- [x] Today composition bar: 24h horizontal bar (sleep · blocks · free), markers at 6/12/18/24
- [x] Settings: focus category picker dropdown in preferences, saved immediately
- [x] Category-agnostic OptimizationStrip (dynamic per-category stats, no hardcoded deep/meeting/recovery)
- [x] Category-agnostic ledger metrics (Load / Consistency / Variety replacing Depth / Cadence / Recovery)

---

## Page Overhaul
- [x] Rearrange/Repurpose page section structuring, reduce unecessary pages, rearrange content (List content to make cohesive changes)
- [x] Integrate Atlas (commitments) into Today page: commitment card with add button, highlighted commitments, next commitment, and loose (undated) commitment blocks draggable into DayPlanner timeline
- [x] Profile button repurposement — sidebar profile now opens full settings dropdown (language/theme/import/export/reset/signout); topbar simplified to search+compose only
- [x] File selector with small preview horizontal slider (akin to save files)
- [x] Integrate block category creation section (from settings) into main page
- [x] Refine category creation section — inline label/description editing with save/cancel, mini block preview pills, restore defaults, create/delete categories with warning dialog, color picker palette

---

## Cross-Day Logic
- [x] Restrict cross-day functionality to valid boundary states only
- [x] Restore legacy compression behavior when cross-day is disabled
- [x] Prevent invalid overflow dragging (cascade preview shows committed result)
- [x] Preserve minimum duration rules
- [x] Normalize cross-midnight intervals (clockTimeFromMin now returns "24:00" for midnight)
- [x] Prevent negative-height states (dragged blocks capped at 6px minimum)
- [x] Improve split-block rendering

---

# Goals & Progression

## Goal System
- [x] Goal data model (types, schema migration, store CRUD)
- [x] Count goals
- [x] Duration goals
- [x] Numeric accumulation goals
- [x] Deadline goals
- [x] Weighted progression
- [x] Goal UI components (GoalDialog, GoalCard, GoalSection, GoalList)
- [x] Category-based auto-tracking (goal blocks aggregate across shared categoryId)
- [x] Prominent auto-track section in GoalDialog with 3 modes (Always / Selected / Commitments)
- [x] Three auto-track modes with per-goal progress computation
- [x] Commitment generation for goals (generateGoalCommitments, looseCommitmentIds)
- [x] DayPlanner assign mode overlay + tracked block indicators
- [x] BlockDetailsDialog tracked-goals section with per-goal toggle
- [x] Goal completion indicator ("Complete" badge at 100%)
- [x] Period-aware Today filtering (activity-based, not just period)
- [x] Goal description editing in GoalDialog
- [x] Tracking type badge on GoalCard (e.g. [Count] [Check-ins])
- [x] Inverted card sizes (Today grid, Week stacked)
- [x] [+ Add] dashed button on Week goal list
- [x] Start date toggle as shadcn Switch
- [x] Habit streaks
- [x] Long-term progression tracking

---

## Metrics
- [x] Focus metrics
- [x] Recovery metrics
- [x] Consistency metrics
- [x] Completion metrics (goal progress in ledger)
- [x] Weekly analytics
- [x] Timeline progress overlays

---

## Goal Visualization
- [x] Progress bars (linear for duration)
- [x] Segmented dot-based progress (count + numeric goals)
- [x] Circular ring progress (deadline goals)
- [x] Period-aware progress (daily/weekly/monthly block filtering)
- [x] Weekly goal tracking (GoalList on Week page)
- [x] Progress summaries with per-goal breakdown (GoalSection + ProgressDialog)
- [x] Goal completion badge indicator
- [x] Deadline indicators (GoalCard badge, DayPlanner banner, Week upcoming deadlines chip list)
- [x] Long-term charts (ProgressChart on non-compact GoalCard)

---

# Workspace Architecture

## Goal

Replace the current Extension/Plugin architecture with a category-owned structured context system.

Chronos is a planner.

It is **not** a plugin platform.

It is **not** a collection of mini-applications.

The objective is to enrich scheduled blocks with structured execution context while keeping Categories, Blocks, and Goals as the only first-class planning concepts.

---

# Target Architecture

```txt
ScheduleData
├── Categories
│   └── Structure
│       ├── Levels
│       ├── Templates
│       ├── Rotation
│       └── Display Rules
│
├── Blocks
│   └── Runtime Data
│
└── Goals
```

The category owns the structure.

The block owns the runtime state.

The renderer is generic.

No extension system exists.

---

# Phase 1 — Remove Extension Architecture — DONE

## Registry Removal

* [x] Remove ExtensionDefinition
* [x] Remove registerExtension()
* [x] Remove getExtension()
* [x] Remove getRegisteredExtensions()
* [x] Remove extension registries

## Storage Cleanup

* [x] Remove Category.extensionId
* [x] Remove Category.extensionConfig
* [x] Remove Block.extensions
* [x] Replace with:

  * [x] Category.workspace
  * [x] Block.workspace

## Delete Legacy Extension System

* [x] Remove entire `src/lib/extensions/` directory
* [x] registry.ts
* [x] types.ts
* [x] runtime.ts
* [x] migration.ts
* [x] schema.ts
* [x] gym/*
* [x] any extension-specific rendering logic (BlockSchemaUI rewritten, ActivityStructureView deleted)

Success criteria:

* No extension-related types remain in the codebase.
* No runtime extension lookups remain.
* `src/test/extensions.test.ts` deleted — 110 remaining tests pass.

---

# Phase 2 — Category-Owned Structure

## New Category Structure

Introduce:

```ts
interface CategoryStructure {
  levels: LevelDef[];
  display: DisplayConfig;
  templates: TreeNode[];
  rotation?: Record<string, string>;
}
```

Category becomes:

```ts
interface Category {
  ...
  structure?: CategoryStructure;
}
```

## Runtime Storage

Introduce:

```ts
interface Block {
  ...
  runtime?: RuntimeData;
}
```

Runtime data stores execution state only.

Examples:

Workout:

```json
{
  "completed": [true, false, true]
}
```

Reading:

```json
{
  "pagesRead": 15
}
```

Study:

```json
{
  "completedActivities": [...]
}
```

Success criteria:

* Categories contain complete structure definitions.
* Blocks contain only execution state.

---

# Phase 3 — Generic Structure Engine

## Level Definition

Create generic level schema:

```ts
interface LevelDef {
  key: string;
  label: string;
  fields: FieldDef[];
  tracking?: TrackingDef;
}
```

Support:

* [x] Text fields
* [x] Number fields
* [x] Boolean tracking
* [x] Numeric tracking

No domain-specific fields.

No workout-specific concepts.

Runtime engine implemented in `src/lib/schedule/workspace-engine.ts`:

- `selectTemplate(structure, name?)` — resolves active template by name, falls back to first
- `initRuntime(structure, templateName?)` — creates blank `WorkspaceRuntime` with default tracking values
- `calcProgress(runtime, structure)` — returns `{done, total}` for progress display
- `toggleTracking(runtime, key)` — toggles a boolean tracking value immutably
- `setTracking(runtime, key, value)` — sets a tracking value immutably
- `getTrackingLeaves(structure, runtime)` — returns all tracking leaf nodes with paths, labels, and values
- `resolveActiveTemplateName(runtime)` — returns the active template name string

---

# Phase 4 — Generic Renderers

## Template Editor (replaces WorkspaceTreeEditor)

Form-based list editor. No tree navigation, no levels, no hierarchy.

Capabilities:

* [x] Add item with name, group, sets count, field values
* [x] Rename item inline
* [x] Remove item or group
* [x] Groups auto-created from item group field
* [x] Existing groups suggested via datalist
* [x] Works with any depth (template list → items grouped by first-level child)

No breadcrumbs. No drill-down. No level concepts exposed.

---

## Summary Renderer

Generate:

```txt
Upper A · 12/18
Reading · 15/30
Calculus · 4/6
```

using display rules only.

No custom renderer per preset.

---

## Session View Renderer (replaces Quick Access + Full Workspace)

Provide:

* [x] Three-state surface: Preview / Active / Completed
* [x] Preview: full plan view with groups and item details
* [x] Active: current step dominates, collapsible groups, one-tap completion
* [x] Completed: recap with completion statistics
* [x] Boolean tracking (checkboxes)
* [x] Numeric tracking (number input)
* [x] Group-level progress rollups
* [x] No expandable hierarchy (flat list with group labels)
* [x] No level navigation controls

No preset-specific UI.

---

# Phase 5 — Preset System

Presets become initialization data only.

Location:

```txt
src/workspaces/presets.ts
```

No React.

No rendering code.

Only data.

---

## Workout Preset

* [x] Group level
* [x] Exercise level
* [x] Set level
* [x] Rotation support

---

## Reading Preset

* [x] Book level
* [x] Session level
* [x] Page tracking

---

## Study Preset

* [x] Subject level
* [x] Activity level
* [x] Completion tracking

---

Success criteria:

Deleting every preset must not break the system.

The planner must continue functioning.

---

# Phase 6 — Category Settings UI

## Category Card

* [x] Workspace type selection built into category creation dialog
* [x] Template count shown on category card (e.g., "3 programs")
* [x] TemplateEditor opens on config click (form-based list, no tree)
* [x] "Remove" detaches workspace from category

Implemented in `src/pages/dashboard/Today.tsx` — the category creation dialog includes a type picker (Workout/Reading/Study/None) that calls `preset.create()` to initialize `category.workspace`. The config dialog uses `TemplateEditor` for list-based editing — add items with name, group, sets, and field values. No tree navigation, no breadcrumbs, no level concepts exposed.

---

# Phase 7 — Planner Integration

## Timeline Blocks

Display:

```txt
Gym  Upper A  ▶ 2/5  → Bench Press · Set 2/3
```

Requirements:

* [x] Structure presence visible without clicking
* [x] Progress visible without opening dialogs
* [x] Session state indicator (not started ▶ in progress ✓ completed)
* [x] Next action in natural language

---

## Block Details / Session View

* [x] Single Session View replaces Quick Access + Full Workspace
* [x] Three states: Preview (not started), Active (in progress), Completed (recap)
* [x] Current step dominates active state
* [x] No separate Full Workspace View

---

## Compose Block

Requirements:

* [x] Template/program picker when category has multiple templates
* [x] Runtime generated automatically from selected template
* [x] No manual attachment step
* [x] No extension toggles
* [x] No tool selectors

Block creation shows a program dropdown for workspace-enabled categories (ComposeBlockDialog generates `initRuntime(cat.workspace, selectedTemplate)` on submit).

---

# Phase 7 — Migration

Provide migration path:

Old:

```txt
extensionId
extensionConfig
extensions
```

New:

```txt
structure
runtime
```

Requirements:

* [x] Existing schedules continue working
* [x] Existing workout data migrates automatically
* [x] No manual user intervention

Migration is implemented in `normalizeNamingModel()` in `src/lib/schedule/store.tsx` — converts old `extensionId="gym"` + `extensionConfig` to `Category.workspace`, and old `block.extensions` to `Block.workspace`.

---

# Phase 8 — UX Reset & Validation

## Workspace UI Redesign (Jun 2026)

The entire workspace UI was redesigned from first principles. The following concepts were removed from the user-facing UI:

* [x] "Workspace" terminology (replaced by domain language: programs, exercises, sets, books, sessions)
* [x] Tree editor (replaced by flat list editor with group labels)
* [x] Breadcrumb drill-down navigation (replaced by inline editing)
* [x] Quick Access panel (replaced by Session View)
* [x] Full Workspace View (replaced by Session View with 3 states)
* [x] SchemaSummary/SchemaQuickAccess/SchemaWorkspace adapter layer
* [x] "Template" / "Level" / "Node" / "Hierarchy" in user-facing text

New surface: **Session View** — a single adaptive dialog with three states:
- **Preview** — plan view before starting ("Start Session" button)
- **Active** — execution view with current step, progress, and controls
- **Completed** — recap with completion statistics

New surface: **Template Editor** — replaces WorkspaceTreeEditor with a form-based list where users add items with name, group, sets, and field values. No tree navigation.

New surface: **Block Session Badge** — replaces SchemaSummary with compact status indicator (○/▶/✓), template name, progress fraction, and next action.

Block interaction: tapping a block opens Session View directly, not separate Quick Access + Full Workspace.

## Validated Workflow

```txt
Create Category
      ↓
Pick Session Type (Workout/Reading/Study/None) — built into creation dialog
      ↓
Add Programs (optional, can do later)
      ↓
Schedule Block → Pick Program (dropdown in ComposeBlockDialog)
      ↓
See Progress On Timeline (badge shows ○ name done/total → next)
      ↓
Tap Block → Session View (preview → execute → recap)
```

1. **Create Category** — `Today.tsx` "New Category" button with workspace type picker
2. **Pick Session Type** — Type selection built into creation; preset.create() called automatically
3. **Add Programs** — `TemplateEditor` provides form-based CRUD (no tree navigation)
4. **Schedule Block** — `ComposeBlockDialog` shows program picker, generates `initRuntime(cat.workspace, templateName)`
5. **See Progress On Timeline** — `BlockSessionBadge` shows ○/▶/✓ + template name + `done/total` + next step
6. **Tap Block → Session View** — `SessionView` in Dialog, unified 3-state surface (preview → active → completed)

Replaced files:
* `BlockSchemaUI.tsx` — deleted
* `WorkspaceSummary.tsx` — replaced by `BlockSessionBadge` in `SessionView.tsx`
* `WorkspaceQuickAccess.tsx` — deleted (replaced by `SessionView.tsx`)
* `WorkspaceView.tsx` — deleted (replaced by `SessionView.tsx`)
* `WorkspaceTreeEditor.tsx` — deleted (replaced by `TemplateEditor.tsx`)
* `SessionView.tsx` — NEW: unified preview/active/completed surface
* `TemplateEditor.tsx` — NEW: form-based list editor

without:

* [x] Extensions
* [x] Tools
* [x] Registries
* [x] Domain-specific code
* [x] Tree navigation
* [x] Workspace terminology in UI

---

# Final Success Criteria

The architecture is complete when:

* [x] No extension system exists
* [x] No plugin system exists
* [x] Categories fully own structure
* [x] Blocks fully own runtime state
* [x] Renderers are entirely generic
* [x] Presets are optional
* [x] Deleting all presets does not break functionality
* [x] Workout is no longer a special architectural case
* [x] Chronos remains a planner first, with structured session context layered on top

---

## Final Refinements (UI)
- [x] Remake timer section (Focus page hourglass redesign, session card + timer card)
- [ ] Make pop-up card above profile card; Display relevant blocks;
- [x] Focus sections accurate hourglass UI
- [ ] Rethink "System" section; Rethink readding settings tab; Check relevancy; Check possible new settings to add (e.g. Keybinds, Shortcuts;)
- [ ] Complete "Week" page redesign
- [ ] Rethink "Week" page functionality; ponder whether to integrate drag system or not;
- [ ] Move "Weekly" stats from today page into week; create new ones for today and week;
- [ ] Improve Week display/Month display
- [ ] Improve "Focus" concept; Highlight "Focus" blocks in category creator;
- [ ] Better time search UI on create/edit blocks; Fix weird spacing on boxes when searching; Add smarter searching (ex: typing "4" will result in 4AM and 4PM as topmost options)
- [ ] Improve top-left card; Fix spacing/Out of bounds issue
- [ ] Created categories have innacurate color display across all instances
- [ ] No way to rearrange created categories
- [ ] Remove any trace of system-baked instances (Categories, Goals, Extensions, Blocks, anything.) System should be fully modular.
- [ ] "New block" button tries creating a 1h block in now bar instead of 09:00 default

---

# AI Planning Layer

## Current State
- [x] Basic AI integration

---

## AI Assistant Features
- [ ] Intelligent block suggestions
- [ ] Commitment auto-fitting
- [ ] Recovery balancing
- [ ] Overload detection
- [ ] Circadian consistency analysis
- [ ] Goal-aware planning
- [ ] Dynamic block generation
- [ ] Commitment generation
- [ ] Schedule optimization
- [ ] Adaptive week restructuring
- [ ] First time users introduction system
- [ ] Create from scratch or templates

---

## AI Autonomy System
- [ ] Conservative mode
- [ ] Balanced mode
- [ ] Aggressive mode
- [ ] Autonomy control UI
- [ ] Adjustable restructuring freedom
- [ ] AI explainability layer

---


# Local-First & Cloud Architecture

## Current
- [x] Local persistence

---

## Planned Cloud Features
- [ ] Authentication
- [ ] Cross-device sync
- [ ] Cloud backup
- [ ] Realtime updates
- [ ] Conflict resolution
- [ ] Sync queue system
- [ ] Background synchronization

---

## Infrastructure
- [ ] Supabase integration
- [ ] PostgreSQL schema
- [ ] Local-first sync layer
- [ ] Optional online mode
- [ ] Service worker persistence

---

# Mobile & PWA

## Platform Expansion
- [ ] Installable PWA
- [ ] Offline support
- [ ] Mobile layouts
- [ ] Responsive planner interactions
- [ ] Mobile timeline UX refinement

---

## Notifications
- [ ] Daily agenda notifications
- [ ] Current block notifications
- [ ] Next block notifications
- [ ] Context-aware reminders
- [ ] Persistent planner overlays
- [ ] Widget-style agenda components

---

## Mobile Ecosystem
- [ ] Mobile-first notification flow
- [ ] Home-screen widgets
- [ ] Background updates
- [ ] Cross-device continuity

---

# UI / UX / Design

## Landing Page
- [ ] Full redesign
- [ ] Cinematic hero section
- [ ] Interactive planner showcase
- [ ] Animated timeline previews
- [ ] Motion-driven sections
- [ ] Product storytelling

---

## Visual Identity
- [ ] Premium typography
- [ ] Spatial consistency
- [ ] Motion system
- [ ] Refined hierarchy
- [ ] Improved dark theme
- [ ] Advanced transitions
- [ ] Premium interaction polish

---

## Design Direction
Inspired by:
- [ ] Linear
- [ ] Arc
- [ ] Raycast
- [ ] Vercel
- [ ] Read.cv

---

# Technical Refactors

## Architecture
- [ ] Planner modularization
- [ ] Timeline engine cleanup
- [ ] Better domain separation
- [ ] Cleaner interaction systems
- [ ] Unified timeline normalization

---

## State & Performance
- [ ] Reduce planner complexity
- [ ] Improve drag stability
- [ ] Optimize rerenders
- [ ] Better persistence handling
- [ ] Optimize interaction performance

---

# Long-Term Vision

- [ ] Fully adaptive planner
- [ ] Intelligent temporal assistant
- [ ] AI-generated routines
- [ ] Autonomous schedule balancing
- [ ] Cross-platform continuity
- [ ] Production-ready infrastructure
- [ ] Fully polished premium experience

---

# Product Direction

Chronos should remain:
- focused
- structured
- intentional
- visually refined
- timeline-centered

Chronos should avoid becoming:
- a generic productivity app
- a bloated feature suite
- a traditional task manager
- a cluttered super-app

The planner itself is the product.