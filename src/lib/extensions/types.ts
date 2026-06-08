import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { RoutineBlock, Commitment } from "@/lib/schedule/types";

export interface ActionDef {
  id: string;
  label: string;
  icon?: LucideIcon;
  run: (ctx: ExtensionContext) => void;
}

export interface ExtensionContext {
  categoryId: string;
  categoryConfig: unknown;
  selectedDate: string;
  /** All routines for the current schedule */
  routines: RoutineBlock[];
  /** All commitments for the current schedule */
  commitments: Commitment[];
  addRoutine: (block: Omit<RoutineBlock, "id">) => string | null;
  addCommitment: (c: Omit<Commitment, "id">) => string | null;
  /** Update the category's extensionConfig */
  updateCategoryConfig: (config: unknown) => void;
}

export interface BlockExtension {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Per-block metadata schema (fields for an individual block) */
  schema: Record<string, FieldDef>;

  // ── Per-block hooks (existing) ──────────────────────────
  /** Rendered inline on a block in DayPlanner */
  renderBadge?: (data: unknown) => ReactNode;
  /** Rendered in BlockDetailsDialog */
  renderDetails?: (data: unknown) => ReactNode;
  /** Rendered in ComposeBlockDialog / BlockEditDialog, edits per-block data */
  renderEditor?: (data: unknown, onChange: (next: unknown) => void) => ReactNode;
  parse?: (raw: unknown) => unknown;
  serialize?: (data: unknown) => unknown;

  // ── Category-level hooks (new) ──────────────────────────
  /** Schema for category-wide extension configuration (e.g. templates, rotation) */
  categorySchema?: Record<string, FieldDef>;
  /** Full editor for the category extension config */
  renderCategoryConfig?: (config: unknown, onChange: (next: unknown) => void) => ReactNode;

  // ── Sheet view (new) ────────────────────────────────────
  /** Full-page modal view of the extension data for a specific block.
   *  Receives the per-block data + category config. */
  renderSheet?: (blockData: unknown, ctx: ExtensionContext) => ReactNode;

  // ── Actions (new) ───────────────────────────────────────
  /** Action buttons displayed in category headers / block menus */
  renderActions?: (ctx: ExtensionContext) => ActionDef[];

  // ── Generation (new) ────────────────────────────────────
  /** Default per-block extension data when creating a new block
   *  for a category that has this extension bound. */
  generateBlockData?: (categoryConfig: unknown, day?: number, date?: string) => unknown;
}

export type FieldDef = {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  options?: string[];
  defaultValue?: unknown;
};
