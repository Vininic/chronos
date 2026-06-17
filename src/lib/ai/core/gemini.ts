import type { ScheduleContext, AutonomyLevel } from "../context/ScheduleContext";
import { buildSystemPrompt } from "./systemPrompt";
import { compressContext } from "../context/serializers";
import { validateResponseStructure, selfCorrectResponse } from "./selfCorrection";
import type { AetherisResponse, Suggestion, RecoveryAnalysis, Insight, ActionProposal, ExecutiveSummary } from "./schemas";
import { loadProfile } from "../learning/store";
import type { LLMProvider } from "./provider";
import { getApiKeyForProvider } from "../settings/store";
import { GeminiAdapter } from "./adapters/gemini";

export interface GeminiAnalysisResult {
  response: AetherisResponse;
  suggestions: Suggestion[];
  recoveryAnalysis: RecoveryAnalysis;
}

let _sugIdCounter = 0;
function generateSuggestionId(): string {
  return `sug-${Date.now()}-${_sugIdCounter++}`;
}

function fallbackSummary(ctx: ScheduleContext): ExecutiveSummary {
  return {
    status: ctx.blocks.length === 0 ? "attention" : "healthy",
    headline: `${ctx.blocks.length} blocks, ${ctx.goals.length} goals — AI analysis unavailable`,
    keyMetrics: {
      blocks: ctx.blocks.length,
      goals: ctx.goals.length,
      focusHours: Math.round(ctx.metrics.focusTimeMin / 60 * 10) / 10,
      recoveryHours: Math.round(ctx.metrics.recoveryTimeMin / 60 * 10) / 10,
    },
  };
}

function fallbackAnalysis(ctx: ScheduleContext, autonomy: AutonomyLevel): GeminiAnalysisResult {
  const genAt = new Date().toISOString();
  const response: AetherisResponse = {
    version: 1,
    generatedAt: genAt,
    summary: fallbackSummary(ctx),
    insights: [],
    suggestedActions: [],
    explainability: {
      reasoning: [],
      affectedGoals: [],
      affectedBlocks: [],
      affectedMetrics: [],
      expectedImpact: "AI analysis unavailable — check your API key or provider settings",
      confidence: 0,
    },
    autonomyLevel: autonomy,
  };
  return { response, suggestions: [], recoveryAnalysis: fallbackRecovery() };
}

function fallbackRecovery(): RecoveryAnalysis {
  return { recoveryScore: 0, sustainableScore: 0, overloadDetected: false, burnoutDetected: false, recommendations: [] };
}

function parseJSONResponse(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim();
  return JSON.parse(cleaned);
}

function extractSuggestions(data: Record<string, unknown>): Suggestion[] {
  const raw = data.suggestions;
  if (!Array.isArray(raw)) return [];
  return raw.map((s: Record<string, unknown>) => ({
    id: generateSuggestionId(),
    type: String(s.type ?? "general"),
    title: String(s.title ?? ""),
    detail: String(s.detail ?? ""),
    priority: (s.priority === "low" || s.priority === "medium" || s.priority === "high") ? s.priority : "medium",
    actionable: s.actionable === true,
  }));
}

function extractRecovery(data: Record<string, unknown>): RecoveryAnalysis {
  const r = data.recoveryAnalysis as Record<string, unknown> | undefined;
  if (!r) return fallbackRecovery();
  return {
    recoveryScore: typeof r.recoveryScore === "number" ? r.recoveryScore : 0,
    sustainableScore: typeof r.sustainableScore === "number" ? r.sustainableScore : 0,
    overloadDetected: r.overloadDetected === true,
    burnoutDetected: r.burnoutDetected === true,
    recommendations: Array.isArray(r.recommendations) ? r.recommendations.map(String) : [],
  };
}

function extractInsights(data: Record<string, unknown>): Insight[] {
  const raw = data.insights;
  if (!Array.isArray(raw)) return [];
  return raw.map((i: Record<string, unknown>) => ({
    type: String(i.type ?? "unknown"),
    severity: (i.severity === "info" || i.severity === "warning" || i.severity === "critical") ? i.severity : "info",
    title: String(i.title ?? ""),
    detail: String(i.detail ?? ""),
    suggestion: i.suggestion ? String(i.suggestion) : undefined,
    confidence: typeof i.confidence === "number" ? i.confidence : 0.5,
  }));
}

function extractActions(data: Record<string, unknown>): ActionProposal[] {
  const raw = data.suggestedActions;
  if (!Array.isArray(raw)) return [];
  return raw.map((a: Record<string, unknown>) => ({
    action: String(a.action ?? ""),
    params: typeof a.params === "object" && a.params !== null ? a.params as Record<string, unknown> : {},
    reason: String(a.reason ?? ""),
    impact: String(a.impact ?? ""),
    confidence: typeof a.confidence === "number" ? a.confidence : 0.5,
  }));
}

function summarizeLearningProfile(): string {
  try {
    const profile = loadProfile();
    const prefs = profile.categoryPreferences;
    const prefSummary = prefs
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5)
      .map((p) => `${p.categoryId}: ${Math.round(p.completionRate * 100)}% completion, avg ${Math.round(p.averageDurationMin)}min, ${p.consistency > 0.5 ? "consistent" : "variable"} schedule`)
      .join("\n");

    const windows = profile.productivityWindows;
    const focusPeak = windows
      .filter((w) => w.type === "focus")
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((w) => `${w.hour}:00 (score ${Math.round(w.score * 100)})`)
      .join(", ");

    const recoveryPeak = windows
      .filter((w) => w.type === "recovery")
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((w) => `${w.hour}:00 (score ${Math.round(w.score * 100)})`)
      .join(", ");

    return [
      prefSummary ? `--- High-success categories ---\n${prefSummary}` : "",
      focusPeak ? `--- Peak focus windows ---\n${focusPeak}` : "",
      recoveryPeak ? `--- Peak recovery windows ---\n${recoveryPeak}` : "",
    ].filter(Boolean).join("\n\n");
  } catch {
    return "";
  }
}

function buildAnalysisPrompt(ctx: ScheduleContext, autonomy: AutonomyLevel): string {
  const systemPrompt = buildSystemPrompt(autonomy);
  const compressed = compressContext(ctx);
  const serialized = JSON.stringify(compressed, null, 2);
  const learningSummary = summarizeLearningProfile();

  const sections = [systemPrompt, "", "## Schedule Data", "", serialized];
  if (learningSummary) {
    sections.push("", "## Learning Profile (historical patterns)", "", learningSummary);
  }
  sections.push("", "## Response", "");
  sections.push("Analyze the schedule data above and return ONLY valid JSON with this structure:");
  sections.push(`{
  "summary": {
    "status": "healthy|attention|critical",
    "headline": "Short one-line summary of schedule health",
    "keyMetrics": {
      "blocks": <number>,
      "focusHours": <number>,
      "recoveryHours": <number>,
      "sleepAvgHours": <number>,
      "completionRate": <number 0-100>,
      "overload": <number 0-100>,
      "consistency": <number 0-100>
    }
  },
  "insights": [
    {
      "type": "overload|burnout_risk|sleep_debt|context_switching|consecutive_work|goal_neglected|goal_conflict|weekly_imbalance|optimization|recommendation",
      "severity": "info|warning|critical",
      "title": "Short title",
      "detail": "Detailed explanation based on actual schedule data",
      "suggestion": "Actionable suggestion addressing the issue",
      "confidence": 0.0-1.0
    }
  ],
  "suggestedActions": [
    {
      "action": "add_block|move_block|add_recovery|reschedule|create_commitment|etc",
      "params": {},
      "reason": "Why this action helps",
      "impact": "Expected outcome",
      "confidence": 0.0-1.0
    }
  ],
  "suggestions": [
    {
      "type": "block|commitment_fit|gap|focus_session|deep_work|recovery|habit",
      "title": "Short suggestion title",
      "detail": "Explanation of the suggestion",
      "priority": "low|medium|high",
      "actionable": true
    }
  ],
  "recoveryAnalysis": {
    "recoveryScore": <0-100>,
    "sustainableScore": <0-100>,
    "overloadDetected": <bool>,
    "burnoutDetected": <bool>,
    "recommendations": ["Specific recovery action 1", "Specific recovery action 2"]
  },
  "explainability": {
    "reasoning": ["Step-by-step reasoning for the analysis"],
    "affectedGoals": ["Goal titles affected"],
    "affectedBlocks": ["Block IDs affected"],
    "affectedMetrics": ["Metric names affected"],
    "expectedImpact": "Overall expected impact of proposed actions",
    "confidence": 0.0-1.0
  }
}`);

  return sections.join("\n");
}

export async function callGemini(
  ctx: ScheduleContext,
  autonomy: AutonomyLevel,
  provider?: LLMProvider,
): Promise<GeminiAnalysisResult> {
  const fullPrompt = buildAnalysisPrompt(ctx, autonomy);

  try {
    if (provider) {
      const result = await provider.generateContent(fullPrompt, {
        systemPrompt: buildSystemPrompt(autonomy),
        temperature: 0.3,
        maxTokens: 4096,
      });
      return processResponse(result.text, ctx, autonomy);
    }

    const apiKey = typeof import.meta !== "undefined"
      ? import.meta.env.VITE_GEMINI_API_KEY ?? getApiKeyForProvider("gemini")
      : getApiKeyForProvider("gemini");

    if (!apiKey) {
      return fallbackAnalysis(ctx, autonomy);
    }

    const geminiProvider = new GeminiAdapter({ apiKey, model: "gemini-2.0-flash" });
    const result = await geminiProvider.generateContent(fullPrompt, {
      systemPrompt: buildSystemPrompt(autonomy),
      temperature: 0.3,
      maxTokens: 4096,
    });
    return processResponse(result.text, ctx, autonomy);
  } catch {
    return fallbackAnalysis(ctx, autonomy);
  }
}

function processResponse(rawText: string, ctx: ScheduleContext, autonomy: AutonomyLevel): GeminiAnalysisResult {
  const parsed = parseJSONResponse(rawText);
  const validation = validateResponseStructure(parsed);

  let corrected: Record<string, unknown>;
  if (!validation.valid) {
    corrected = selfCorrectResponse(parsed, {
      blockCount: ctx.blocks.length,
      goalCount: ctx.goals.length,
    }) as unknown as Record<string, unknown>;
  } else {
    corrected = parsed;
  }

  const genAt = new Date().toISOString();
  const response: AetherisResponse = {
    version: 1,
    generatedAt: genAt,
    summary: corrected.summary as ExecutiveSummary ?? fallbackSummary(ctx),
    insights: extractInsights(corrected),
    suggestedActions: extractActions(corrected),
    explainability: corrected.explainability as AetherisResponse["explainability"] ?? {
      reasoning: [],
      affectedGoals: [],
      affectedBlocks: [],
      affectedMetrics: [],
      expectedImpact: "Generated by AI",
      confidence: 0.5,
    },
    autonomyLevel: autonomy,
  };

  return {
    response,
    suggestions: extractSuggestions(corrected),
    recoveryAnalysis: extractRecovery(corrected),
  };
}
