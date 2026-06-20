import { globalToolRegistry } from "./registry";
import { runSafetyChecks, allSafetyChecksPass } from "./safety";
import type { ScheduleContext } from "../context";
import type { RoutineBlock } from "@/lib/schedule/types";
import { parseMin } from "../utils/time";

interface BlockParams {
  title: string;
  start: string;
  end: string;
  category: string;
  day: number;
  notes?: string;
}

interface UpdateBlockParams {
  blockId: string;
  patch: Partial<{
    title: string;
    start: string;
    end: string;
    category: string;
    notes: string;
  }>;
}

interface MoveBlockParams {
  blockId: string;
  newStart: string;
  newEnd: string;
}

interface SplitBlockParams {
  blockId: string;
  splitTime: string;
}

interface MergeBlocksParams {
  blockIds: string[];
  mergedTitle?: string;
}

export function registerBlockTools(
  ctx: ScheduleContext,
  mutators: {
    addRoutine: (b: Omit<RoutineBlock, "id">) => string | null;
    updateRoutine: (id: string, patch: Partial<RoutineBlock>) => string | null;
    removeRoutine: (id: string) => void;
  },
): void {
  globalToolRegistry.register<BlockParams, string | null>({
    name: "createBlock",
    description: "Create a new routine block",
    category: "block",
    permission: "write",
    validate: (p) => {
      if (!p.title) return "title is required";
      if (!p.start) return "start is required";
      if (!p.end) return "end is required";
      if (!p.category) return "category is required";
      return null;
    },
    execute: (p) => {
      const checks = runSafetyChecks(ctx, "createBlock", p);
      if (!allSafetyChecksPass(checks)) {
        throw new Error(checks.find((c) => !c.passed)!.detail);
      }
      return mutators.addRoutine({
        day: p.day,
        start: p.start,
        end: p.end,
        kind: p.category,
        title: p.title,
        notes: p.notes,
      });
    },
  });

  globalToolRegistry.register<UpdateBlockParams, string | null>({
    name: "updateBlock",
    description: "Update an existing block's properties",
    category: "block",
    permission: "write",
    validate: (p) => {
      if (!p.blockId) return "blockId is required";
      return null;
    },
    execute: (p) => {
      const safetyChecks = runSafetyChecks(ctx, "updateBlock", { ...p.patch, blockId: p.blockId });
      if (!allSafetyChecksPass(safetyChecks)) {
        throw new Error(safetyChecks.find((c) => !c.passed)!.detail);
      }
      return mutators.updateRoutine(p.blockId, p.patch as Partial<RoutineBlock>);
    },
  });

  globalToolRegistry.register<MoveBlockParams, string | null>({
    name: "moveBlock",
    description: "Move a block to a different time slot",
    category: "block",
    permission: "write",
    validate: (p) => {
      if (!p.blockId) return "blockId is required";
      if (!p.newStart) return "newStart is required";
      if (!p.newEnd) return "newEnd is required";
      return null;
    },
    execute: (p) => {
      const checks = runSafetyChecks(ctx, "moveBlock", { start: p.newStart, end: p.newEnd });
      if (!allSafetyChecksPass(checks)) {
        throw new Error(checks.find((c) => !c.passed)!.detail);
      }
      return mutators.updateRoutine(p.blockId, { start: p.newStart, end: p.newEnd });
    },
  });

  globalToolRegistry.register<SplitBlockParams, { firstId?: string; secondId?: string }>({
    name: "splitBlock",
    description: "Split a block into two at a given time",
    category: "block",
    permission: "write",
    validate: (p) => {
      if (!p.blockId) return "blockId is required";
      if (!p.splitTime) return "splitTime is required";
      return null;
    },
    execute: (p) => {
      const block = ctx.blocks.find((b) => b.id === p.blockId);
      if (!block) throw new Error(`Block "${p.blockId}" not found`);
      if (p.splitTime <= block.start || p.splitTime >= block.end) {
        throw new Error("splitTime must be between block start and end");
      }
      mutators.updateRoutine(p.blockId, { end: p.splitTime });
      const newId = mutators.addRoutine({
        day: new Date().getDay(),
        start: p.splitTime,
        end: block.end,
        kind: block.category,
        title: block.title,
      });
      return { firstId: p.blockId, secondId: newId ?? undefined };
    },
  });

  globalToolRegistry.register<MergeBlocksParams, string | null>({
    name: "mergeBlocks",
    description: "Merge two or more consecutive blocks",
    category: "block",
    permission: "write",
    validate: (p) => {
      if (!p.blockIds || p.blockIds.length < 2) return "At least 2 blockIds required";
      return null;
    },
    execute: (p) => {
      const toMerge = p.blockIds.map((id) => ctx.blocks.find((b) => b.id === id)).filter(Boolean);
      if (toMerge.length < 2) throw new Error("Could not find all specified blocks");
      const sorted = toMerge.sort((a, b) => parseMin(a!.start) - parseMin(b!.start));
      const mergedStart = sorted[0]!.start;
      const mergedEnd = sorted[sorted.length - 1]!.end;
      const mergedTitle = p.mergedTitle ?? sorted.map((b) => b!.title).join(" + ");

      for (let i = 1; i < sorted.length; i++) {
        mutators.removeRoutine(sorted[i]!.id);
      }
      mutators.updateRoutine(sorted[0]!.id, { start: mergedStart, end: mergedEnd, title: mergedTitle });
      return sorted[0]!.id;
    },
  });

  globalToolRegistry.register<string, null | { title: string; start: string; end: string; category: string; blockId: string }>({
    name: "deleteBlock",
    description: "Delete a block by ID",
    category: "block",
    permission: "write",
    validate: (blockId) => {
      if (!blockId) return "blockId is required";
      return null;
    },
    execute: (blockId) => {
      const checks = runSafetyChecks(ctx, "deleteBlock", { blockId });
      if (!allSafetyChecksPass(checks)) {
        throw new Error(checks.find((c) => !c.passed)!.detail);
      }
      const block = ctx.blocks.find((b) => b.id === blockId);
      mutators.removeRoutine(blockId);
      if (block) {
        return { title: block.title, start: block.start, end: block.end, category: block.category, blockId };
      }
      return null;
    },
  });
}


