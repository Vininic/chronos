import type { ScheduleData } from "@/lib/schedule/types";
import { globalToolRegistry, type ToolResult } from "./registry";
import { buildContext, type ScheduleContext } from "../context";

function createReadTools(data: ScheduleData) {
  const ctx = buildContext(data);

  globalToolRegistry.register({
    name: "getSchedule",
    description: "Get the complete schedule context with all data",
    category: "read",
    permission: "read",
    execute: () => ctx,
  });

  globalToolRegistry.register({
    name: "getBlocks",
    description: "Get all scheduled blocks for today",
    category: "read",
    permission: "read",
    execute: () => ctx.blocks,
  });

  globalToolRegistry.register({
    name: "getCommitments",
    description: "Get all commitments (fixed + flexible)",
    category: "read",
    permission: "read",
    execute: () => ctx.commitments,
  });

  globalToolRegistry.register({
    name: "getGoals",
    description: "Get all tracked goals",
    category: "read",
    permission: "read",
    execute: () => ctx.goals,
  });

  globalToolRegistry.register({
    name: "getCategories",
    description: "Get all activity categories",
    category: "read",
    permission: "read",
    execute: () => ctx.categories,
  });

  globalToolRegistry.register({
    name: "getPrograms",
    description: "Get all program templates and their progress",
    category: "read",
    permission: "read",
    execute: () => ctx.programs,
  });

  globalToolRegistry.register({
    name: "getMetrics",
    description: "Get schedule health metrics",
    category: "read",
    permission: "read",
    execute: () => ctx.metrics,
  });

  globalToolRegistry.register({
    name: "getSleepHistory",
    description: "Get sleep schedule and metrics",
    category: "read",
    permission: "read",
    execute: () => ctx.sleep,
  });

  globalToolRegistry.register({
    name: "getNotes",
    description: "Get all notes from blocks and commitments",
    category: "read",
    permission: "read",
    execute: () => ctx.notes,
  });
}

export function registerReadTools(data: ScheduleData): void {
  createReadTools(data);
}

export function getReadTool(name: string, data: ScheduleData): ToolResult<unknown> {
  createReadTools(data);
  return globalToolRegistry.execute(name, {});
}
