import { globalToolRegistry } from "./registry";
import type { Commitment, RoutineBlock } from "@/lib/schedule/types";

interface CreateCommitmentParams {
  title: string;
  start: string;
  end: string;
  day: number;
  date: string;
  weekdays?: number[];
  kind: string;
  commitmentType?: "fixed" | "flexible";
  notes?: string;
}

interface UpdateCommitmentParams {
  commitmentId: string;
  patch: Partial<{
    title: string;
    start: string;
    end: string;
    date: string;
    kind: string;
    notes: string;
  }>;
}

interface MoveCommitmentParams {
  commitmentId: string;
  newStart: string;
  newEnd: string;
  newDate?: string;
}

export function registerCommitmentTools(
  mutators: {
    addCommitment: (c: Omit<Commitment, "id">) => string | null;
    removeCommitment: (id: string) => void;
    updateCommitment: (id: string, patch: Partial<Commitment>) => string | null;
    addRoutine: (b: Omit<RoutineBlock, "id">) => string | null;
    removeRoutine: (id: string) => void;
  },
): void {
  globalToolRegistry.register<CreateCommitmentParams, string | null>({
    name: "createCommitment",
    description: "Create a new commitment",
    category: "commitment",
    permission: "write",
    validate: (p) => {
      if (!p.title) return "title is required";
      if (!p.start) return "start is required";
      if (!p.end) return "end is required";
      if (!p.date && !p.weekdays) return "date or weekdays is required";
      return null;
    },
    execute: (p) => {
      return mutators.addCommitment({
        title: p.title,
        start: p.start,
        end: p.end,
        date: p.date,
        kind: p.kind,
        notes: p.notes ?? "",
        workspace: undefined,
      });
    },
  });

  globalToolRegistry.register<UpdateCommitmentParams, string | null>({
    name: "updateCommitment",
    description: "Update an existing commitment",
    category: "commitment",
    permission: "write",
    validate: (p) => {
      if (!p.commitmentId) return "commitmentId is required";
      return null;
    },
    execute: (p) => mutators.updateCommitment(p.commitmentId, p.patch),
  });

  globalToolRegistry.register<MoveCommitmentParams, string | null>({
    name: "moveCommitment",
    description: "Move a commitment to a different time or date",
    category: "commitment",
    permission: "write",
    validate: (p) => {
      if (!p.commitmentId) return "commitmentId is required";
      if (!p.newStart) return "newStart is required";
      if (!p.newEnd) return "newEnd is required";
      return null;
    },
    execute: (p) => {
      const patch: Partial<Commitment> = { start: p.newStart, end: p.newEnd };
      if (p.newDate) patch.date = p.newDate;
      return mutators.updateCommitment(p.commitmentId, patch);
    },
  });

  globalToolRegistry.register<string, void>({
    name: "deleteCommitment",
    description: "Delete a commitment by ID",
    category: "commitment",
    permission: "write",
    validate: (id) => (id ? null : "commitmentId is required"),
    execute: (id) => mutators.removeCommitment(id),
  });
}
