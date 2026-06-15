import type { ScheduleContext } from "../context/ScheduleContext";
import type { Insight, ActionProposal, ExplainabilityReport } from "./schemas";

export function buildExplainability(
  ctx: ScheduleContext,
  insights: Insight[],
  actions: ActionProposal[],
  dataConfidence?: number,
): ExplainabilityReport {
  const reasoning = [
    ...insights.map((i) => i.detail),
    ...actions.map((a) => `${a.action}: ${a.reason}`),
  ];

  const affectedGoalIds = new Set<string>();
  const affectedBlockIds: string[] = [];
  const affectedMetrics = new Set<string>();

  for (const i of insights) {
    if (i.type.startsWith("goal_")) {
      const goal = ctx.goals.find((g) => g.title === i.title);
      if (goal) affectedGoalIds.add(goal.title);
    }
    if (i.type === "overload" || i.type === "burnout_risk") {
      affectedMetrics.add("overloadScore");
      affectedMetrics.add("recoveryTimeMin");
      affectedBlockIds.push(...ctx.blocks.slice(0, 3).map((b) => b.id));
    }
  }

  for (const a of actions) {
    if (a.action.startsWith("add_") || a.action.startsWith("move_")) {
      const block = ctx.blocks.find((b) => b.id === a.params.blockId);
      if (block) affectedBlockIds.push(block.id);
    }
  }

  const expectedImpact = actions.length > 0
    ? `${actions.length} action(s) proposed. Expected to address ${insights.filter((i) => i.severity === "critical").length} critical and ${insights.filter((i) => i.severity === "warning").length} warning-level issues.`
    : "No actions proposed — schedule appears stable.";

  const actionConfidence = actions.reduce((a, b) => a + b.confidence, 0) / Math.max(1, actions.length);
  const finalConfidence = dataConfidence !== undefined ? (dataConfidence + actionConfidence) / 2 : actionConfidence;

  return {
    reasoning,
    affectedGoals: [...affectedGoalIds],
    affectedBlocks: [...new Set(affectedBlockIds)],
    affectedMetrics: [...affectedMetrics],
    expectedImpact,
    confidence: finalConfidence,
  };
}
