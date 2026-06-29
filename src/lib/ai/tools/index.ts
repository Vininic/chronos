import type { ScheduleData } from "@/lib/schedule/types";
import type { ScheduleContext, AutonomyLevel } from "../context";
import { buildContext } from "../context";
import { globalToolRegistry, type ToolDefinition, type ToolResult } from "./registry";
import { registerReadTools } from "./readTools";
import { registerBlockTools } from "./blockTools";
import { registerNoteTools } from "./noteTools";
import { registerCommitmentTools } from "./commitmentTools";
import { registerGoalTools } from "./goalTools";
import { registerCategoryTools } from "./categoryTools";
import { registerProgramTools } from "./programTools";
import { registerSessionTools } from "./sessionTools";
import { registerRegenerateTools } from "./regenerateTools";
import { registerExportTools } from "./exportTools";

export type { ToolDefinition, ToolResult } from "./registry";
export { globalToolRegistry } from "./registry";
export { runSafetyChecks, allSafetyChecksPass } from "./safety";
export type { SafetyCheck } from "./safety";

type Mutator<F> = F;
type RoutineMutator = (b: Record<string, unknown>) => string | null;

export function registerAllTools(
  data: ScheduleData,
  mutators: {
    addRoutine: Mutator<(b: Record<string, unknown>) => string | null>;
    updateRoutine: Mutator<(id: string, patch: Record<string, unknown>) => string | null>;
    removeRoutine: (id: string) => void;
    addCommitment: Mutator<(c: Record<string, unknown>) => string | null>;
    removeCommitment: (id: string) => void;
    updateCommitment: Mutator<(id: string, patch: Record<string, unknown>) => string | null>;
    addGoal: Mutator<(g: Record<string, unknown>) => string>;
    updateGoal: (id: string, patch: Record<string, unknown>) => void;
    removeGoal: (id: string) => void;
    addCategory: (c: Record<string, unknown>) => void;
    updateCategory: (id: string, patch: Record<string, unknown>) => void;
    removeCategory: (id: string) => void;
  },
  autonomy?: AutonomyLevel,
): void {
  const ctx = buildContext(data, autonomy ?? "balanced");

  registerReadTools(data);
  registerBlockTools(ctx, mutators);
  registerNoteTools(ctx, mutators);
  registerCommitmentTools(mutators);
  registerGoalTools(mutators);
  registerCategoryTools(mutators);
  registerProgramTools(mutators);
  registerSessionTools(ctx, mutators);
  registerRegenerateTools();
  registerExportTools(() => data);
}
