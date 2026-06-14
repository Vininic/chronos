import type { ScheduleData } from "@/lib/schedule/types";
import { buildContext } from "../context/buildContext";
import { validateContext } from "../context/validation";
import { summarizeContextHealth } from "../context/debug";
import { evaluateAllRules, ruleSummary } from "../rules/understanding";
import { validateScheduleChange } from "../engine/scheduler";
import { analyzeRecovery, assessRecoveryIntelligence } from "../engine/recovery";
import { analyzeGoals } from "../engine/goals";
import { analyzeWeek } from "../engine/weekly";
import type { AutonomyLevel } from "../context/ScheduleContext";
import type { AetherisResponse, Insight, ActionProposal, ExecutiveSummary, InsightSeverity } from "./schemas";
import { scoreConfidence } from "./confidence";
import { buildExplainability } from "./explainability";
import { buildSystemPrompt } from "./systemPrompt";
import { generateSuggestions } from "../suggestions/suggestionEngine";
import type { Suggestion } from "../suggestions/suggestionEngine";
import { optimizeSchedule } from "../optimization/optimizationEngine";
import type { OptimizationResult } from "../optimization/optimizationEngine";
import type { RecoveryIntelligenceResult } from "../engine/recovery";

export interface AetherisPipelineInput {
  data: ScheduleData;
  autonomy?: AutonomyLevel;
  proposedChanges?: {
    start?: string;
    end?: string;
    category?: string;
    addedMinutes?: number;
    newBlockCount?: number;
  };
}

export interface AetherisPipelineResult {
  response: AetherisResponse;
  contextTokenEstimate: number;
  ruleCheckSummary: { passed: number; total: number; failing: string[] };
  systemPrompt: string;
  suggestions: Suggestion[];
  optimization: OptimizationResult;
  recoveryIntelligence: RecoveryIntelligenceResult;
}

export function runAetherisPipeline(input: AetherisPipelineInput): AetherisPipelineResult {
  const autonomy = input.autonomy ?? "balanced";
  const ctx = buildContext(input.data, autonomy);

  const validation = validateContext(ctx);
  const health = summarizeContextHealth(ctx);
  const rules = evaluateAllRules(ctx);
  const ruleChecks = ruleSummary(rules);

  const recoverySignals = analyzeRecovery(ctx);
  const recoveryIntel = assessRecoveryIntelligence(ctx);
  const goalInsights = analyzeGoals(ctx);
  const weeklyInsights = analyzeWeek(ctx);

  let schedulerInsights: Insight[] = [];
  if (input.proposedChanges) {
    const violations = validateScheduleChange(ctx, input.proposedChanges);
    schedulerInsights = violations.map((v) => ({
      type: "scheduler_violation",
      severity: (v.severity === "error" ? "critical" : "warning") as InsightSeverity,
      title: v.rule,
      detail: v.detail,
      suggestion: v.detail,
      confidence: 0.9,
    }));
  }

  const insights: Insight[] = [
    ...recoverySignals.map((s) => ({
      type: s.type,
      severity: s.severity === "high" ? "critical" as const : s.severity === "medium" ? "warning" as const : "info" as const,
      title: s.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      detail: s.detail,
      suggestion: s.suggestion,
      confidence: recoveryIntel.recoveryScore / 100,
    })),
    ...goalInsights.map((g) => ({
      type: `goal_${g.type}`,
      severity: "warning" as InsightSeverity,
      title: g.goalTitle,
      detail: g.detail,
      suggestion: g.suggestion,
      confidence: 0.5 + (ctx.goals.find((x) => x.id === g.goalId)?.progress ?? 0) * 0.4,
    })),
    ...weeklyInsights.map((w) => ({
      type: `weekly_${w.type}`,
      severity: "info" as InsightSeverity,
      title: w.type.charAt(0).toUpperCase() + w.type.slice(1),
      detail: w.detail,
      suggestion: w.suggestion,
      confidence: 0.7,
    })),
    ...schedulerInsights,
  ];

  const suggestedActions: ActionProposal[] = [];
  for (const ins of insights) {
    if (ins.suggestion && ins.severity !== "info") {
      suggestedActions.push({
        action: `address_${ins.type}`,
        params: {},
        reason: ins.detail,
        impact: ins.suggestion,
        confidence: ins.confidence,
      });
    }
  }

  const summary: ExecutiveSummary = {
    status: health.status,
    headline: createHeadline(health.status, ctx),
    keyMetrics: {
      blocks: ctx.blocks.length,
      goals: ctx.goals.length,
      focusHours: Math.round(ctx.metrics.focusTimeMin / 60 * 10) / 10,
      recoveryHours: Math.round(ctx.metrics.recoveryTimeMin / 60 * 10) / 10,
      sleepAvgHours: Math.round(ctx.sleep.metrics.averageDurationMin / 60 * 10) / 10,
      completionRate: ctx.blocks.length > 0
        ? Math.round(ctx.blocks.filter((b) => b.complete).length / ctx.blocks.length * 100)
        : 0,
      recoveryScore: recoveryIntel.recoveryScore,
      sustainableScore: recoveryIntel.sustainableScore,
    },
  };

  const confidence = scoreConfidence({
    contextFreshnessMs: Date.now() - new Date(ctx.generatedAt).getTime(),
    blockCount: ctx.blocks.length,
    goalCount: ctx.goals.length,
    hasSleepData: ctx.sleep.blocks.length > 0,
    hasHistoricalData: ctx.historicalCompletion.length > 0,
    validationErrors: validation.errors.length,
    validationWarnings: validation.warnings.length,
  });

  const suggestions = generateSuggestions(ctx);
  const optimization = optimizeSchedule(ctx);

  const response: AetherisResponse = {
    version: 1,
    generatedAt: new Date().toISOString(),
    summary,
    insights,
    suggestedActions,
    explainability: buildExplainability(ctx, insights, suggestedActions),
    autonomyLevel: autonomy,
  };

  return {
    response,
    contextTokenEstimate: Math.round(JSON.stringify(ctx).length / 4),
    ruleCheckSummary: {
      passed: ruleChecks.passed,
      total: ruleChecks.total,
      failing: ruleChecks.failing.map((r) => r.rule),
    },
    systemPrompt: buildSystemPrompt(autonomy),
    suggestions,
    optimization,
    recoveryIntelligence: recoveryIntel,
  };
}

function createHeadline(status: "healthy" | "attention" | "critical", ctx: {
  blocks: unknown[];
  goals: unknown[];
}): string {
  if (status === "critical") {
    return `${ctx.blocks.length} blocks, ${ctx.goals.length} goals — critical issues detected`;
  }
  if (status === "attention") {
    return `${ctx.blocks.length} blocks, ${ctx.goals.length} goals — some areas need attention`;
  }
  return `${ctx.blocks.length} blocks, ${ctx.goals.length} goals — schedule looks healthy`;
}
