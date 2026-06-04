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

# Modular Block Extensions

Chronos should support generic structured block extensions.

Examples:
- workout templates
- study systems
- checklists
- review logs
- execution tracking

These systems should remain modular and generic.

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
- [ ] Integrate Atlas (commitments) into Today page: commitment card with add button, highlighted commitments, next commitment, and loose (undated) commitment blocks draggable into DayPlanner timeline
- [ ] Add block type categories section from Settings to main page and refinements

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
- [ ] Count goals
- [ ] Duration goals
- [ ] Numeric accumulation goals
- [ ] Deadline goals
- [ ] Weighted progression
- [ ] Habit streaks
- [ ] Long-term progression tracking

---

## Metrics
- [ ] Focus metrics
- [ ] Recovery metrics
- [ ] Consistency metrics
- [ ] Completion metrics
- [ ] Weekly analytics
- [ ] Timeline progress overlays

---

## Goal Visualization
- [ ] Progress bars
- [ ] Weekly goal tracking
- [ ] Deadline indicators
- [ ] Long-term charts
- [ ] Progress summaries

---

# Modular Block Extensions

## Extension Architecture
- [ ] Generic extension system
- [ ] Structured block metadata
- [ ] Extension renderer pipeline
- [ ] Reusable block modules

---

## Planned Extensions
- [ ] Workout extension
- [ ] Exercise templates
- [ ] Set/repetition tracking
- [ ] Study extension
- [ ] Review systems
- [ ] Checklist extension
- [ ] Execution logs
- [ ] Progress logging

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