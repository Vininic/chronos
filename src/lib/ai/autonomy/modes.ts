import { AUTONOMY_PRESETS, type AutonomyConfig } from "./autonomyControls";
import type { AutonomyLevel } from "../context/ScheduleContext";

export interface ModeTransition {
  from: AutonomyLevel;
  to: AutonomyLevel;
  timestamp: string;
  reason?: string;
}

export class AutonomyModeManager {
  private currentLevel: AutonomyLevel = "balanced";
  private transitionHistory: ModeTransition[] = [];

  get level(): AutonomyLevel {
    return this.currentLevel;
  }

  get config(): AutonomyConfig {
    return AUTONOMY_PRESETS[this.currentLevel];
  }

  setLevel(level: AutonomyLevel, reason?: string): void {
    const from = this.currentLevel;
    this.currentLevel = level;
    this.transitionHistory.push({
      from,
      to: level,
      timestamp: new Date().toISOString(),
      reason,
    });
  }

  getHistory(): ModeTransition[] {
    return [...this.transitionHistory];
  }

  canExecuteAction(action: string, category?: string): boolean {
    const requiresConfirm = !this.config.autoExecuteWriteWithoutConfirmation;
    const isDestructive = ["delete", "remove", "archive"].some((p) => action.includes(p));
    const isProtectedCategory = category && this.config.requireApprovalForCategories.includes(category);

    if (["read", "get"].some((p) => action.startsWith(p))) return true;
    if (isDestructive && !this.config.autoExecuteDestructiveWithConfirmation) return false;
    if (isProtectedCategory && requiresConfirm) return false;
    return this.config.autoExecuteWriteWithoutConfirmation;
  }
}

export const globalAutonomyManager = new AutonomyModeManager();
