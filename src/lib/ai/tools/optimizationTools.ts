import { globalToolRegistry } from "./registry";
import { runSafetyChecks, allSafetyChecksPass } from "./safety";
import type { ScheduleContext } from "../context";
import type { RoutineBlock, Commitment, Goal } from "@/lib/schedule/types";

export function registerOptimizationTools(
  ctx: ScheduleContext,
  mutators: {
    addRoutine: (b: Omit<RoutineBlock, "id">) => string | null;
    removeRoutine: (id: string) => void;
    updateRoutine: (id: string, patch: Partial<RoutineBlock>) => string | null;
    addCommitment: (c: Omit<Commitment, "id">) => string | null;
    updateCommitment: (id: string, patch: Partial<Commitment>) => string | null;
    removeCommitment: (id: string) => void;
    addGoal: (g: Omit<Goal, "id" | "blocks" | "subTasks" | "looseCommitmentIds" | "createdAt">) => string;
    updateGoal: (id: string, patch: Partial<Goal>) => void;
    removeGoal: (id: string) => void;
  },
): void {
  globalToolRegistry.register<{ commitmentId: string; newStart: string; newEnd: string }, void>({
    name: "autoFitCommitment",
    description: "Automatically find the best time slot for a commitment",
    category: "optimization",
    permission: "write",
    validate: (p) => {
      if (!p.commitmentId) return "commitmentId is required";
      return null;
    },
    execute: (p) => {
      const checks = runSafetyChecks(ctx, "autoFitCommitment", p);
      if (!allSafetyChecksPass(checks)) {
        throw new Error(checks.find((c) => !c.passed)!.detail);
      }
      mutators.updateCommitment(p.commitmentId, { start: p.newStart, end: p.newEnd });
    },
  });

  globalToolRegistry.register<{ day: number }, void>({
    name: "optimizeDay",
    description: "Optimize a single day's schedule for flow and balance",
    category: "optimization",
    permission: "write",
    validate: (p) => (p.day !== undefined ? null : "day is required"),
    execute: (p) => {
      const checks = runSafetyChecks(ctx, "optimizeDay", p);
      if (!allSafetyChecksPass(checks)) {
        throw new Error(checks.find((c) => !c.passed)!.detail);
      }
      const dayBlocks = ctx.blocks.filter((b) => {
        const day = new Date().getDay();
        return day === p.day;
      });
      const recoveryBlocks = dayBlocks.filter((b) => b.category === "recovery");
      if (recoveryBlocks.length === 0) {
        mutators.addRoutine({
          day: p.day,
          start: "12:00",
          end: "12:30",
          kind: "recovery",
          title: "Recovery break (auto-optimized)",
        });
      }
    },
  });

  globalToolRegistry.register<void, void>({
    name: "optimizeWeek",
    description: "Run full week optimization — balance categories, add recovery, fix gaps",
    category: "optimization",
    permission: "write",
    execute: () => {
      const checks = runSafetyChecks(ctx, "optimizeWeek", {});
      if (!allSafetyChecksPass(checks)) {
        throw new Error(checks.find((c) => !c.passed)!.detail);
      }
      for (let day = 1; day <= 5; day++) {
        const dayBlocks = ctx.blocks.filter((b) => {
          const d = new Date().getDay();
          return d === day;
        });
        const hasRecovery = dayBlocks.some((b) => b.category === "recovery");
        if (!hasRecovery) {
          mutators.addRoutine({
            day,
            start: "12:00",
            end: "12:30",
            kind: "recovery",
            title: "Recovery break (weekly optimization)",
          });
        }
      }
    },
  });

  globalToolRegistry.register<void, void>({
    name: "rebalanceGoals",
    description: "Rebalance goal priorities based on progress and deadlines",
    category: "optimization",
    permission: "write",
    execute: () => {
      const checks = runSafetyChecks(ctx, "rebalanceGoals", {});
      if (!allSafetyChecksPass(checks)) {
        throw new Error(checks.find((c) => !c.passed)!.detail);
      }
      for (const g of ctx.goals) {
        if (g.progress < 0.1 && g.daysRemaining !== undefined && g.daysRemaining < 14) {
          mutators.updateGoal(g.id, { weight: Math.min(5, g.weight + 1) });
        }
      }
    },
  });

  globalToolRegistry.register<void, void>({
    name: "recoverSchedule",
    description: "Run full recovery analysis and apply fixes",
    category: "optimization",
    permission: "write",
    execute: () => {
      const checks = runSafetyChecks(ctx, "rebalanceGoals", {});
      if (!allSafetyChecksPass(checks)) {
        throw new Error(checks.find((c) => !c.passed)!.detail);
      }
      if (ctx.metrics.recoveryTimeMin < 60) {
        for (let day = 1; day <= 5; day++) {
          mutators.addRoutine({
            day,
            start: "15:00",
            end: "15:30",
            kind: "recovery",
            title: "Recovery (auto)",
          });
        }
      }
    },
  });
}
