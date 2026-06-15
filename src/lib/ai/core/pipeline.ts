import type { ScheduleData } from "@/lib/schedule/types";
import { buildContext } from "../context/buildContext";
import { validateContext } from "../context/validation";
import { summarizeContextHealth } from "../context/debug";
import { evaluateAllRules, ruleSummary } from "../rules/understanding";
import { validateScheduleChange } from "../engine/scheduler";
import type { AutonomyLevel } from "../context/ScheduleContext";
import type { AetherisResponse, Insight, InsightSeverity, Suggestion, RecoveryAnalysis } from "./schemas";
import { scoreConfidence } from "./confidence";
import { buildExplainability } from "./explainability";
import { buildSystemPrompt } from "./systemPrompt";
import { optimizeSchedule } from "../optimization/optimizationEngine";
import type { OptimizationResult } from "../optimization/optimizationEngine";
import { callGemini } from "./gemini";
import { compressedTokenEstimate, compressContext } from "../context/serializers";

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
  recoveryIntelligence: RecoveryAnalysis;
}

export async function runAetherisPipeline(input: AetherisPipelineInput): Promise<AetherisPipelineResult> {
  const autonomy = input.autonomy ?? "balanced";
  const ctx = buildContext(input.data, autonomy);

  const validation = validateContext(ctx);
  const health = summarizeContextHealth(ctx);
  const rules = evaluateAllRules(ctx);
  const ruleChecks = ruleSummary(rules);

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

  const aiResult = await callGemini(ctx, autonomy);
  const { response, suggestions, recoveryAnalysis } = aiResult;

  const allInsights = [...schedulerInsights, ...response.insights];

  const confidence = scoreConfidence({
    contextFreshnessMs: Date.now() - new Date(ctx.generatedAt).getTime(),
    blockCount: ctx.blocks.length,
    goalCount: ctx.goals.length,
    hasSleepData: ctx.sleep.blocks.length > 0,
    hasHistoricalData: ctx.historicalCompletion.length > 0,
    validationErrors: validation.errors.length,
    validationWarnings: validation.warnings.length,
  });

  const optimization = optimizeSchedule(ctx);

  const finalResponse: AetherisResponse = {
    ...response,
    insights: allInsights,
    explainability: buildExplainability(ctx, allInsights, response.suggestedActions),
  };

  const compressed = compressContext(ctx);

  return {
    response: finalResponse,
    contextTokenEstimate: compressedTokenEstimate(compressed),
    ruleCheckSummary: {
      passed: ruleChecks.passed,
      total: ruleChecks.total,
      failing: ruleChecks.failing.map((r) => r.rule),
    },
    systemPrompt: buildSystemPrompt(autonomy),
    suggestions,
    optimization,
    recoveryIntelligence: recoveryAnalysis,
  };
}
