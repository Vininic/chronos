import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ScheduleContext, AutonomyLevel } from "../context/ScheduleContext";
import { buildSystemPrompt } from "./systemPrompt";
import { compressContext } from "../context/serializers";
import { validateResponseStructure, selfCorrectResponse } from "./selfCorrection";
import type { AetherisResponse, Suggestion, RecoveryAnalysis, Insight, ActionProposal, ExecutiveSummary } from "./schemas";

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
      expectedImpact: "AI analysis unavailable — check your VITE_GEMINI_API_KEY environment variable",
      confidence: 0,
    },
    autonomyLevel: autonomy,
  };
  return { response, suggestions: [], recoveryAnalysis: fallbackRecovery() };
}

function fallbackRecovery(): RecoveryAnalysis {
  return { recoveryScore: 0, sustainableScore: 0, overloadDetected: false, burnoutDetected: false, recommendations: [] };
}

function parseGeminiResponse(text: string): Record<string, unknown> {
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

export async function callGemini(ctx: ScheduleContext, autonomy: AutonomyLevel): Promise<GeminiAnalysisResult> {
  const apiKey = typeof import.meta !== "undefined" ? import.meta.env.VITE_GEMINI_API_KEY : undefined;

  if (!apiKey) {
    return fallbackAnalysis(ctx, autonomy);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const systemPrompt = buildSystemPrompt(autonomy);
    const compressed = compressContext(ctx);
    const serialized = JSON.stringify(compressed, null, 2);

    const fullPrompt = [
      systemPrompt,
      "",
      "## Schedule Data",
      "",
      serialized,
      "",
      "## Response",
      "",
      "Return ONLY valid JSON with this structure:",
      JSON.stringify({
        summary: { status: "healthy|attention|critical", headline: "string", keyMetrics: {} },
        insights: [{ type: "string", severity: "info|warning|critical", title: "string", detail: "string", suggestion: "string", confidence: 0.8 }],
        suggestedActions: [{ action: "string", params: {}, reason: "string", impact: "string", confidence: 0.8 }],
        suggestions: [{ type: "string", title: "string", detail: "string", priority: "low|medium|high", actionable: true }],
        recoveryAnalysis: { recoveryScore: 0, sustainableScore: 0, overloadDetected: false, burnoutDetected: false, recommendations: ["string"] },
        explainability: { reasoning: ["string"], affectedGoals: ["string"], affectedBlocks: ["string"], affectedMetrics: ["string"], expectedImpact: "string", confidence: 0.8 },
      }, null, 2),
    ].join("\n");

    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    const parsed = parseGeminiResponse(text);

    const validation = validateResponseStructure(parsed);
    let corrected: Record<string, unknown>;
    if (!validation.valid) {
      corrected = selfCorrectResponse(parsed, { blockCount: ctx.blocks.length, goalCount: ctx.goals.length }) as unknown as Record<string, unknown>;
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
        reasoning: [], affectedGoals: [], affectedBlocks: [], affectedMetrics: [],
        expectedImpact: "Generated by Gemini", confidence: 0.5,
      },
      autonomyLevel: autonomy,
    };

    return {
      response,
      suggestions: extractSuggestions(corrected),
      recoveryAnalysis: extractRecovery(corrected),
    };
  } catch {
    return fallbackAnalysis(ctx, autonomy);
  }
}
