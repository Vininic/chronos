import { globalToolRegistry } from "./registry";
import type { ScheduleContext } from "../context";
import type { RoutineBlock } from "@/lib/schedule/types";

interface SessionParams {
  blockId: string;
}

export function registerSessionTools(
  ctx: ScheduleContext,
  mutators: {
    updateRoutine: (id: string, patch: Partial<RoutineBlock>) => string | null;
  },
): void {
  globalToolRegistry.register<SessionParams, void>({
    name: "startSession",
    description: "Start a focused session on a block",
    category: "session",
    permission: "write",
    validate: (p) => (p.blockId ? null : "blockId is required"),
    execute: (p) => {
      mutators.updateRoutine(p.blockId, { workspace: { _sessionStarted: true } });
    },
  });

  globalToolRegistry.register<SessionParams, void>({
    name: "pauseSession",
    description: "Pause the current session",
    category: "session",
    permission: "write",
    validate: (p) => (p.blockId ? null : "blockId is required"),
    execute: (p) => {
      mutators.updateRoutine(p.blockId, { workspace: { _sessionPaused: true } });
    },
  });

  globalToolRegistry.register<SessionParams, void>({
    name: "resumeSession",
    description: "Resume a paused session",
    category: "session",
    permission: "write",
    validate: (p) => (p.blockId ? null : "blockId is required"),
    execute: (p) => {
      mutators.updateRoutine(p.blockId, { workspace: { _sessionPaused: false } });
    },
  });

  globalToolRegistry.register<SessionParams, void>({
    name: "completeSession",
    description: "Mark a session as complete",
    category: "session",
    permission: "write",
    validate: (p) => (p.blockId ? null : "blockId is required"),
    execute: (p) => {
      mutators.updateRoutine(p.blockId, {
        workspace: { _sessionEnded: true, _sessionCompleted: true },
      });
    },
  });
}
