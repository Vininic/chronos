import type { Category, Commitment, RoutineBlock, ScheduleData } from "@/lib/schedule/types";
import * as ScheduleService from "@/lib/schedule/services/ScheduleService";

/** Result of applying one tool call to a draft schedule.
 *  `draft` is always returned (unchanged on failure) so callers can chain. */
export interface DraftToolResult {
  ok: boolean;
  draft: ScheduleData;
  /** Human-readable summary on success (for the chat transcript). */
  message?: string;
  /** Error reason on failure (validation, conflict, sleep overlap, …). */
  error?: string;
}

/** The write tools this executor understands. Read/goal/program/session/note
 *  tools are intentionally out of scope: the draft chat only reshapes the
 *  schedule (blocks, categories, commitments) before Apply commits it. */
const SUPPORTED = new Set([
  "createBlock", "updateBlock", "moveBlock", "splitBlock", "mergeBlocks", "deleteBlock",
  "createCategory", "updateCategory", "deleteCategory",
  "createCommitment", "updateCommitment", "moveCommitment", "deleteCommitment",
]);

export function isDraftSupportedTool(name: string): boolean {
  return SUPPORTED.has(name);
}

/** A ScheduleService transform returns the next `ScheduleData` or an error
 *  string. Normalize that into a DraftToolResult, recomputing derived state
 *  (ledger/scheduledHours) so the live preview stays accurate. */
function settle(prev: ScheduleData, next: ScheduleData | string, message: string): DraftToolResult {
  if (typeof next === "string") return { ok: false, draft: prev, error: next };
  return { ok: true, draft: ScheduleService.withDerived(next), message };
}

/** Apply a single AI tool call to `draft` as a pure transform. Mirrors the
 *  live `globalToolRegistry` write tools but never touches the store — the
 *  whole point of the non-destructive draft flow. */
export function applyDraftToolCall(
  draft: ScheduleData,
  name: string,
  // Params arrive shaped exactly as the registry tools declare them; delete*
  // tools take a bare id string.
  params: unknown,
): DraftToolResult {
  const p = (params ?? {}) as Record<string, unknown>;
  const asId = typeof params === "string" ? params : (p.id as string | undefined);

  switch (name) {
    case "createBlock": {
      return settle(
        draft,
        ScheduleService.addRoutine(draft, {
          day: p.day as number,
          start: p.start as string,
          end: p.end as string,
          kind: p.category as string,
          title: p.title as string,
          notes: p.notes as string | undefined,
        }),
        `Added "${p.title}" (${p.start}–${p.end}).`,
      );
    }

    case "updateBlock": {
      const patch = (p.patch ?? {}) as Record<string, unknown>;
      return settle(
        draft,
        ScheduleService.updateRoutine(draft, p.blockId as string, mapBlockPatch(patch)),
        `Updated block.`,
      );
    }

    case "moveBlock": {
      return settle(
        draft,
        ScheduleService.updateRoutine(draft, p.blockId as string, {
          start: p.newStart as string,
          end: p.newEnd as string,
        }),
        `Moved block to ${p.newStart}–${p.newEnd}.`,
      );
    }

    case "deleteBlock": {
      const id = asId ?? (p.blockId as string | undefined);
      if (!id) return { ok: false, draft, error: "blockId is required" };
      if (!draft.routine.some((r) => r.id === id)) return { ok: false, draft, error: "Block not found." };
      return { ok: true, draft: ScheduleService.withDerived(ScheduleService.removeRoutine(draft, id)), message: "Deleted block." };
    }

    case "splitBlock": {
      const block = draft.routine.find((r) => r.id === p.blockId);
      if (!block) return { ok: false, draft, error: "Block not found." };
      const splitTime = p.splitTime as string;
      if (splitTime <= block.start || splitTime >= block.end) {
        return { ok: false, draft, error: "splitTime must be between block start and end" };
      }
      const shortened = ScheduleService.updateRoutine(draft, block.id, { end: splitTime });
      if (typeof shortened === "string") return { ok: false, draft, error: shortened };
      const added = ScheduleService.addRoutine(shortened, {
        day: block.day,
        start: splitTime,
        end: block.end,
        kind: block.kind,
        title: block.title,
      });
      return settle(draft, added, "Split block in two.");
    }

    case "mergeBlocks": {
      const ids = (p.blockIds ?? []) as string[];
      const toMerge = ids.map((id) => draft.routine.find((b) => b.id === id)).filter(Boolean) as RoutineBlock[];
      if (toMerge.length < 2) return { ok: false, draft, error: "Could not find all specified blocks" };
      const sorted = [...toMerge].sort((a, b) => a.start.localeCompare(b.start));
      let next: ScheduleData = draft;
      for (let i = 1; i < sorted.length; i++) next = ScheduleService.removeRoutine(next, sorted[i].id);
      const merged = ScheduleService.updateRoutine(next, sorted[0].id, {
        start: sorted[0].start,
        end: sorted[sorted.length - 1].end,
        title: (p.mergedTitle as string | undefined) ?? sorted.map((b) => b.title).join(" + "),
      });
      return settle(draft, merged, "Merged blocks.");
    }

    case "createCategory": {
      const cat: Category = {
        id: p.id as string,
        label: p.label as string,
        description: (p.description as string | undefined) ?? "",
        color: (p.color as string | undefined) ?? "#6366f1",
        tone: (p.tone as string | undefined) ?? "neutral",
      };
      if (!cat.id || !cat.label) return { ok: false, draft, error: "id and label are required" };
      return { ok: true, draft: ScheduleService.withDerived(ScheduleService.addCategory(draft, cat)), message: `Added category "${cat.label}".` };
    }

    case "updateCategory": {
      const patch = (p.patch ?? {}) as Record<string, unknown>;
      return { ok: true, draft: ScheduleService.withDerived(ScheduleService.updateCategory(draft, p.categoryId as string, patch)), message: "Updated category." };
    }

    case "deleteCategory": {
      const id = asId ?? (p.categoryId as string | undefined);
      if (!id) return { ok: false, draft, error: "categoryId is required" };
      return { ok: true, draft: ScheduleService.withDerived(ScheduleService.removeCategory(draft, id)), message: "Deleted category." };
    }

    case "createCommitment": {
      return settle(
        draft,
        ScheduleService.addCommitment(draft, {
          title: p.title as string,
          start: p.start as string,
          end: p.end as string,
          date: p.date as string | undefined,
          kind: p.kind as string,
          notes: (p.notes as string | undefined) ?? "",
        }),
        `Added commitment "${p.title}".`,
      );
    }

    case "updateCommitment": {
      const patch = (p.patch ?? {}) as Partial<Commitment>;
      return settle(draft, ScheduleService.updateCommitment(draft, p.commitmentId as string, patch), "Updated commitment.");
    }

    case "moveCommitment": {
      const patch: Partial<Commitment> = { start: p.newStart as string, end: p.newEnd as string };
      if (p.newDate) patch.date = p.newDate as string;
      return settle(draft, ScheduleService.updateCommitment(draft, p.commitmentId as string, patch), "Moved commitment.");
    }

    case "deleteCommitment": {
      const id = asId ?? (p.commitmentId as string | undefined);
      if (!id) return { ok: false, draft, error: "commitmentId is required" };
      return { ok: true, draft: ScheduleService.withDerived(ScheduleService.removeCommitment(draft, id)), message: "Deleted commitment." };
    }

    default:
      return { ok: false, draft, error: `Tool "${name}" is not available while editing a draft.` };
  }
}

/** Block tool patches use `category`; routine blocks use `kind`. */
function mapBlockPatch(patch: Record<string, unknown>): Partial<RoutineBlock> {
  const mapped: Partial<RoutineBlock> = {};
  if (patch.title !== undefined) mapped.title = patch.title as string;
  if (patch.start !== undefined) mapped.start = patch.start as string;
  if (patch.end !== undefined) mapped.end = patch.end as string;
  if (patch.notes !== undefined) mapped.notes = patch.notes as string;
  if (patch.category !== undefined) mapped.kind = patch.category as string;
  return mapped;
}
