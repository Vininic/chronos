import { globalToolRegistry } from "./registry";
import type { Goal } from "@/lib/schedule/types";

interface CreateGoalParams {
  title: string;
  kind: "duration" | "numeric" | "deadline";
  tracking: string;
  period: string;
  categoryId?: string;
  target: number;
  unit?: string;
  weight?: number;
  deadline?: string;
}

interface UpdateGoalParams {
  goalId: string;
  patch: Partial<{
    title: string;
    target: number;
    weight: number;
    deadline: string;
    description: string;
  }>;
}

export function registerGoalTools(
  mutators: {
    addGoal: (g: Omit<Goal, "id" | "blocks" | "subTasks" | "looseCommitmentIds" | "createdAt">) => string;
    updateGoal: (id: string, patch: Partial<Goal>) => void;
    removeGoal: (id: string) => void;
  },
): void {
  globalToolRegistry.register<CreateGoalParams, string>({
    name: "createGoal",
    description: "Create a new goal",
    category: "goal",
    permission: "write",
    validate: (p) => {
      if (!p.title) return "title is required";
      if (!p.kind) return "kind is required";
      if (p.target <= 0) return "target must be positive";
      return null;
    },
    execute: (p) => mutators.addGoal({
      title: p.title,
      kind: p.kind,
      tracking: p.tracking as Goal["tracking"],
      period: p.period as Goal["period"],
      categoryId: p.categoryId,
      target: p.target,
      unit: p.unit,
      weight: p.weight ?? 1,
      deadline: p.deadline,
      description: "",
      startDate: new Date().toISOString().slice(0, 10),
    }),
  });

  globalToolRegistry.register<UpdateGoalParams, void>({
    name: "updateGoal",
    description: "Update an existing goal",
    category: "goal",
    permission: "write",
    validate: (p) => (p.goalId ? null : "goalId is required"),
    execute: (p) => mutators.updateGoal(p.goalId, p.patch),
  });

  globalToolRegistry.register<string, void>({
    name: "archiveGoal",
    description: "Archive (delete) a goal",
    category: "goal",
    permission: "write",
    validate: (id) => (id ? null : "goalId is required"),
    execute: (id) => mutators.removeGoal(id),
  });

  globalToolRegistry.register<string, void>({
    name: "deleteGoal",
    description: "Permanently remove a goal",
    category: "goal",
    permission: "write",
    validate: (id) => (id ? null : "goalId is required"),
    execute: (id) => mutators.removeGoal(id),
  });
}
