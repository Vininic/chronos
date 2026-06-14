import { globalToolRegistry } from "./registry";
import type { ScheduleContext } from "../context";
import type { RoutineBlock, Commitment } from "@/lib/schedule/types";

interface CreateNoteParams {
  sourceType: "block" | "commitment";
  sourceId: string;
  text: string;
}

interface UpdateNoteParams {
  sourceId: string;
  text: string;
}

interface DeleteNoteParams {
  sourceId: string;
}

export function registerNoteTools(
  _ctx: ScheduleContext,
  mutators: {
    updateRoutine: (id: string, patch: Partial<RoutineBlock>) => string | null;
    updateCommitment: (id: string, patch: Partial<Commitment>) => string | null;
  },
): void {
  globalToolRegistry.register<CreateNoteParams, string | null>({
    name: "createBlockNote",
    description: "Add a note to a block or commitment",
    category: "note",
    permission: "write",
    validate: (p) => {
      if (!p.sourceId) return "sourceId is required";
      if (!p.text) return "text is required";
      return null;
    },
    execute: (p) => {
      if (p.sourceType === "block") {
        return mutators.updateRoutine(p.sourceId, { notes: p.text });
      }
      return mutators.updateCommitment(p.sourceId, { notes: p.text });
    },
  });

  globalToolRegistry.register<UpdateNoteParams, string | null>({
    name: "updateBlockNote",
    description: "Update the note on a block or commitment",
    category: "note",
    permission: "write",
    validate: (p) => {
      if (!p.sourceId) return "sourceId is required";
      if (!p.text) return "text is required";
      return null;
    },
    execute: (p) => {
      const routine = _ctx.blocks.find((b) => b.id === p.sourceId && b.source === "routine");
      if (routine) return mutators.updateRoutine(p.sourceId, { notes: p.text });
      return mutators.updateCommitment(p.sourceId, { notes: p.text });
    },
  });

  globalToolRegistry.register<DeleteNoteParams, string | null>({
    name: "deleteBlockNote",
    description: "Remove the note from a block or commitment",
    category: "note",
    permission: "write",
    validate: (p) => {
      if (!p.sourceId) return "sourceId is required";
      return null;
    },
    execute: (p) => {
      const routine = _ctx.blocks.find((b) => b.id === p.sourceId && b.source === "routine");
      if (routine) return mutators.updateRoutine(p.sourceId, { notes: "" });
      return mutators.updateCommitment(p.sourceId, { notes: "" });
    },
  });
}
