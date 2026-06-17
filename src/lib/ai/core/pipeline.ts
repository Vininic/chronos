import type { ScheduleData } from "@/lib/schedule/types";
import { buildContext } from "../context/buildContext";
import { validateContext } from "../context/validation";
import { summarizeContextHealth } from "../context/debug";
import { evaluateAllRules, ruleSummary } from "../rules/understanding";
import { validateScheduleChange } from "../engine/scheduler";
import type { AutonomyLevel } from "../context/ScheduleContext";
import type { AetherisResponse, Insight, InsightSeverity, Suggestion, RecoveryAnalysis, ActionProposal } from "./schemas";
import { scoreConfidence, interpretConfidence } from "./confidence";
import { buildExplainability } from "./explainability";
import { buildSystemPrompt } from "./systemPrompt";
import { optimizeSchedule } from "../optimization/optimizationEngine";
import type { OptimizationResult } from "../optimization/optimizationEngine";
import { detectPatterns } from "../pattern/detect";
import { callGemini } from "./gemini";
import { compressedTokenEstimate, compressContext } from "../context/serializers";
import type { LLMProvider } from "./provider";
import { createProviderFromSettings, resolveFallbackProvider } from "./registry";
import { loadSettingsSync, getApiKeyForProvider } from "../settings/store";

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
  provider?: LLMProvider;
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

const WRITE_ACTION_PREFIXES = ["add_", "move_", "create_", "update_", "delete_", "remove_", "rebalance_", "schedule_", "auto_fit_"];

function isWriteAction(action: string): boolean {
  return WRITE_ACTION_PREFIXES.some((p) => action.startsWith(p));
}

function filterByAutonomy(
  actions: ActionProposal[],
  suggestions: Suggestion[],
  autonomy: AutonomyLevel,
): { actions: ActionProposal[]; suggestions: Suggestion[] } {
  switch (autonomy) {
    case "conservative":
      return {
        actions: actions.filter((a) => !isWriteAction(a.action)),
        suggestions: suggestions.map((s) => ({ ...s, actionable: false })),
      };
    case "balanced":
      return {
        actions: actions.filter((a) => !isWriteAction(a.action) || !a.action.startsWith("delete_")),
        suggestions,
      };
    case "aggressive":
      return { actions, suggestions };
  }
}

function resolveProvider(): LLMProvider | null {
  const settings = loadSettingsSync();
  const apiKey = settings.apiKeys[settings.providerId] ?? getApiKeyForProvider(settings.providerId);

  if (apiKey) {
    return createProviderFromSettings({
      providerId: settings.providerId,
      apiKey,
      model: settings.models[settings.providerId],
      baseUrl: settings.baseUrls[settings.providerId],
    });
  }

  const fallback = resolveFallbackProvider(settings.providerId, settings.apiKeys);
  return fallback?.provider ?? null;
}

export async function runAetherisPipeline(input: AetherisPipelineInput): Promise<AetherisPipelineResult> {
  const autonomy = input.autonomy ?? "balanced";
  const ctx = buildContext(input.data, autonomy);

  const validation = validateContext(ctx);
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

  const provider = input.provider ?? resolveProvider();
  const aiResult = await callGemini(ctx, autonomy, provider ?? undefined);
  const { response: geminiResponse, suggestions: rawSuggestions, recoveryAnalysis } = aiResult;

  const { actions: filteredActions, suggestions: filteredSuggestions } = filterByAutonomy(
    geminiResponse.suggestedActions,
    rawSuggestions,
    autonomy,
  );

  const allInsights = [...schedulerInsights, ...geminiResponse.insights];

  // Pattern detection from learning profile
  const patterns = detectPatterns();
  for (const p of patterns) {
    allInsights.push({
      type: "pattern",
      severity: p.severity === "high" ? "critical" : p.severity === "medium" ? "warning" : "info",
      title: p.title,
      detail: p.detail,
      suggestion: p.detail,
      confidence: 0.7,
    });
  }

  // Recovery nudges: low recovery score → critical alert
  if (aiResult.recoveryAnalysis.recoveryScore < 30) {
    allInsights.push({
      type: "recovery",
      severity: "critical",
      title: "Recovery score critically low",
      detail: `Your recovery score is ${aiResult.recoveryAnalysis.recoveryScore}. Consider adding rest blocks or reducing intensity.`,
      suggestion: aiResult.recoveryAnalysis.recommendations[0] ?? "Take a lighter day to recover.",
      confidence: 0.85,
    });
  } else if (aiResult.recoveryAnalysis.recoveryScore < 50) {
    allInsights.push({
      type: "recovery",
      severity: "warning",
      title: "Recovery could be better",
      detail: `Your recovery score is ${aiResult.recoveryAnalysis.recoveryScore}. A recovery block today could help.`,
      suggestion: aiResult.recoveryAnalysis.recommendations[0] ?? "Schedule a recovery block.",
      confidence: 0.8,
    });
  }

  if (aiResult.recoveryAnalysis.burnoutDetected) {
    allInsights.push({
      type: "recovery",
      severity: "critical",
      title: "Burnout risk detected",
      detail: "The schedule shows signs of burnout risk. Consider reducing block density and adding recovery time.",
      suggestion: "Reduce total block count by 20% for the next 2 days.",
      confidence: 0.9,
    });
  }

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
    ...geminiResponse,
    insights: allInsights,
    suggestedActions: filteredActions,
    explainability: buildExplainability(ctx, allInsights, filteredActions, confidence),
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
    suggestions: filteredSuggestions,
    optimization,
    recoveryIntelligence: recoveryAnalysis,
  };
}
