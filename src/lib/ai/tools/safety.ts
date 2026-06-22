import type { ScheduleContext } from "../context/ScheduleContext";
import { parseMin } from "../utils/time";

export interface SafetyCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export function runSafetyChecks(
  ctx: ScheduleContext,
  action: string,
  params: Record<string, unknown>,
): SafetyCheck[] {
  const checks: SafetyCheck[] = [];

  switch (action) {
    case "createBlock":
    case "moveBlock":
    case "updateBlock": {
      const start = params.start as string | undefined;
      const end = params.end as string | undefined;
      if (start && end) {
        checks.push(checkOverlap(ctx, start, end));
        checks.push(checkSleepOverlap(ctx, start, end));
      }
      break;
    }
    case "deleteBlock": {
      const blockId = params.blockId as string | undefined;
      if (blockId) {
        const block = ctx.blocks.find((b) => b.id === blockId);
        if (block) {
          checks.push(checkProtectedDeletion(block));
          const goalCheck = checkGoalOrphaning(ctx, blockId);
          if (goalCheck) checks.push(goalCheck);
        }
      }
      break;
    }
    case "autoFitCommitment":
    case "optimizeDay":
    case "optimizeWeek":
    case "rebalanceGoals": {
      checks.push(checkScheduleInvalidity(ctx));
      break;
    }
  }

  return checks;
}

export function allSafetyChecksPass(checks: SafetyCheck[]): boolean {
  return checks.every((c) => c.passed);
}

function checkOverlap(ctx: ScheduleContext, start: string, end: string): SafetyCheck {
  const pStart = parseMin(start);
  const pEnd = parseMin(end);
  const conflicting = ctx.blocks.filter((b) => {
    const bStart = parseMin(b.start);
    const bEnd = parseMin(b.end);
    return pStart < bEnd && pEnd > bStart;
  });
  return {
    check: "Prevent overlap creation",
    passed: conflicting.length === 0,
    detail: conflicting.length > 0
      ? `Overlaps with: ${conflicting.map((b) => b.title).join(", ")}`
      : "No overlap detected",
  };
}

function checkSleepOverlap(ctx: ScheduleContext, start: string, end: string): SafetyCheck {
  const pStart = parseMin(start);
  const pEnd = parseMin(end);
  const conflicting = ctx.sleep.blocks.filter((s) => {
    const sStart = parseMin(s.start);
    const sEnd = parseMin(s.end);
    return pStart < sEnd && pEnd > sStart;
  });
  return {
    check: "Prevent sleep removal",
    passed: conflicting.length === 0,
    detail: conflicting.length > 0 ? "Overlaps with sleep window" : "No sleep overlap",
  };
}

function checkProtectedDeletion(block: { category: string; source: string }): SafetyCheck {
  const protectedCategories = ["recovery"];
  const isProtected = protectedCategories.includes(block.category) || block.source === "commitment";
  return {
    check: "Prevent protected block deletion",
    passed: !isProtected,
    detail: isProtected
      ? `Cannot delete ${block.category} / ${block.source} block — it is protected`
      : "Block is deletable",
  };
}

function checkGoalOrphaning(ctx: ScheduleContext, blockId: string): SafetyCheck | null {
  const linkedGoal = ctx.goals.find((g) =>
    ctx.blocks.some((b) => b.id === blockId && g.categoryId === b.category),
  );
  return linkedGoal
    ? {
        check: "Prevent goal orphaning",
        passed: false,
        detail: `"${linkedGoal.title}" uses this block's category — deletion may impact goal progress`,
      }
    : null;
}

function checkScheduleInvalidity(ctx: ScheduleContext): SafetyCheck {
  const hasBlocks = ctx.blocks.length > 0;
  return {
    check: "Prevent invalid schedules",
    passed: hasBlocks,
    detail: hasBlocks ? "Schedule is valid" : "No blocks in schedule to operate on",
  };
}


