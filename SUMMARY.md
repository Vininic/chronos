## What we've done — Chronos workspace UX rework (ongoing)

### Goal
Make the workspace UX layer meaningful while preserving the core architecture (schema-driven block data + extension registry). The architecture is correct — only the UI layer was wrong.

### Done (Phase 0 — baseline)
- **Deleted `WorkspaceEditor.tsx`** — it exposed framework internals (level config, display config, rotation) which was the original sin
- **Added `preset: string` to `WorkspaceStructure`** — stores the preset label for discoverability in the UI button
- **Added `getNextUndonePath()` to workspace-engine** — returns full ancestry path (e.g. `["Chest", "Bench Press", "Set 1"]`) instead of just the leaf label
- **Removed `getNextUndoneLabel()`** — replaced by `getNextUndonePath()`

### Phase 1 — Meaningful context (done)
- **`WorkspaceSummary.tsx`** — badge now shows template name, progress (done/total), and next undone item with full ancestry path (`→ Chest · Bench Press · Set 1`)
- **`WorkspaceQuickAccess.tsx`** — grouped by parent with ancestry headers, shows next action at top, supports both boolean (checkbox) and number (input) tracking, proper labels for each leaf item
- All renderers guard against `undefined runtime` with `if (!runtime) return null`

### Phase 2 — Content editing (done)

- **`WorkspaceTreeEditor.tsx`** — replaces the old `TemplateContentEditor`. Progressive drill-down navigator:
  - Level 1: Program List (all templates with inline rename, delete, add)
  - Level 2+: Breadcrumb-based drill-down into each level defined by `levels[]`
  - At each level: shows children with inline rename, summary counts (e.g. "2 exercises"), add/delete
  - At leaf level: inline field editing (e.g. Instruction, Rest for sets)
  - Generic: uses `levels[]` for labels, works for any preset
  - No duplicated labels, no expanded tree, no overflowing content
- **Deleted `TemplateContentEditor.tsx`** — replaced by `WorkspaceTreeEditor`

### Phase 3 — Discoverability (done)
- Workspace button text now shows `preset` label (e.g. "Workout Program") instead of cryptic `"3t · 3l"` or a `Table2` icon
- Button text is compact: just the preset name or "Configure"

### Phase 4 — Reduced click depth (done)
- Quick Access groups with ancestry headers: no need to open sub-items to see the full tree
- Next action shown inline at the top of Quick Access

### Phase 5 — Preset label on workspace (done)
- `preset` field stored on each `WorkspaceStructure` object, populated by all three presets (Workout, Reading, Study)
- Button reads `preset` directly for display

### Crash fixes (done)
- `bcp47` reference error in `formatClock` — was `bcp47` vs `bcp47Tag`
- `runtime` undefined in `WorkspaceView`, `WorkspaceQuickAccess`, `WorkspaceSummary` — added guards
- `kindStyle` → `safeKindStyle` in `Week.tsx` and `widgets.tsx`

### Preserved (key decisions)
- **Architecture kept**: schema-driven block data (`SchemaField`), extension registry, `getTrackingLeaves`/`toggleTracking`/`calcProgress` all unchanged
- **No framework internals in UI**: levels, display config, rotation are only set via presets
- **Editing is content-only**: names, fields, tree structure — not levels, tracking types, or display patterns
- **Tests pass**: 110 tests across 7 test files all green
- **Build succeeds**: both dev build and lint pass

### What's next (user expressed intent)
- Badge redesign: icon + label + color/symbol for different workspace types
- Move next-action from badge to separate subtle line below block header
- Quick Access: show parent name prominently; show full item label; bigger click targets
- Config dialog: rename workspace, pick a different preset
- General polish: sizing, spacing, affordances
