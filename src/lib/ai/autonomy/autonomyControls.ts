import type { AutonomyLevel } from "../context/ScheduleContext";

export interface AutonomyConfig {
  level: AutonomyLevel;
  autoExecuteReadTools: boolean;
  autoExecuteWriteWithoutConfirmation: boolean;
  autoExecuteDestructiveWithConfirmation: boolean;
  maxActionsPerSuggestion: number;
  requireApprovalForCategories: string[];
  description: string;
}

export const AUTONOMY_PRESETS: Record<AutonomyLevel, AutonomyConfig> = {
  conservative: {
    level: "conservative",
    autoExecuteReadTools: true,
    autoExecuteWriteWithoutConfirmation: false,
    autoExecuteDestructiveWithConfirmation: false,
    maxActionsPerSuggestion: 1,
    requireApprovalForCategories: ["sleep", "recovery", "fixed_commitment"],
    description: "Only suggest. Never mutate without explicit user confirmation.",
  },
  balanced: {
    level: "balanced",
    autoExecuteReadTools: true,
    autoExecuteWriteWithoutConfirmation: true,
    autoExecuteDestructiveWithConfirmation: false,
    maxActionsPerSuggestion: 3,
    requireApprovalForCategories: ["sleep", "fixed_commitment"],
    description: "Auto-execute low-risk mutations. Require confirmation for destructive changes.",
  },
  aggressive: {
    level: "aggressive",
    autoExecuteReadTools: true,
    autoExecuteWriteWithoutConfirmation: true,
    autoExecuteDestructiveWithConfirmation: true,
    maxActionsPerSuggestion: 10,
    requireApprovalForCategories: [],
    description: "Auto-execute all changes within safety bounds. Log all actions for review.",
  },
};

export function getAutonomyConfig(level: AutonomyLevel): AutonomyConfig {
  return AUTONOMY_PRESETS[level];
}

export function requiresConfirmation(
  config: AutonomyConfig,
  action: string,
  category?: string,
): boolean {
  if (["read", "get"].some((p) => action.startsWith(p))) return false;
  if (!config.autoExecuteWriteWithoutConfirmation) return true;
  if (category && config.requireApprovalForCategories.includes(category)) return true;
  if (["delete", "remove", "archive"].some((p) => action.includes(p))) {
    return !config.autoExecuteDestructiveWithConfirmation;
  }
  return false;
}
