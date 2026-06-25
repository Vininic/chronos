import { describe, it, expect } from "vitest";
import { isWriteAction, filterByAutonomy } from "@/lib/ai/core/pipeline";
import { fallbackAnalysis, processResponse } from "@/lib/ai/core/gemini";
import { validateResponseStructure, selfCorrectResponse } from "@/lib/ai/core/selfCorrection";
import { scoreConfidence, interpretConfidence } from "@/lib/ai/core/confidence";
import { buildExplainability } from "@/lib/ai/core/explainability";
import type { ActionProposal, Suggestion, Insight } from "@/lib/ai/core/schemas";
import { makeCtx, block, goal } from "./aiFixtures";

function action(name: string, confidence = 0.5): ActionProposal {
  return { action: name, params: {}, reason: `do ${name}`, impact: "impact", confidence };
}
function suggestion(over: Partial<Suggestion> = {}): Suggestion {
  return { id: "s1", type: "block", title: "Sugg", detail: "detail", priority: "medium", actionable: true, ...over };
}

/* ── Autonomy gating (pipeline.ts) ─────────────────────────── */

describe("isWriteAction", () => {
  it("recognises write-action prefixes", () => {
    for (const a of ["add_block", "delete_block", "move_block", "rebalance_goals", "auto_fit_commitment"]) {
      expect(isWriteAction(a)).toBe(true);
    }
  });
  it("treats read/analysis actions as non-write", () => {
    for (const a of ["view_summary", "analyze_week", "explain"]) {
      expect(isWriteAction(a)).toBe(false);
    }
  });
});

describe("filterByAutonomy", () => {
  const actions = [action("add_block"), action("delete_block"), action("view_summary")];
  const suggestions = [suggestion()];

  it("conservative: strips every write action and de-activates suggestions", () => {
    const r = filterByAutonomy(actions, suggestions, "conservative");
    expect(r.actions.map((a) => a.action)).toEqual(["view_summary"]);
    expect(r.suggestions.every((s) => s.actionable === false)).toBe(true);
  });

  it("balanced: allows additions but blocks deletions", () => {
    const r = filterByAutonomy(actions, suggestions, "balanced");
    expect(r.actions.map((a) => a.action)).toEqual(["add_block", "view_summary"]);
    expect(r.suggestions[0].actionable).toBe(true);
  });

  it("aggressive: passes everything through", () => {
    const r = filterByAutonomy(actions, suggestions, "aggressive");
    expect(r.actions).toHaveLength(3);
  });
});

/* ── Empty-state fallback (gemini.ts) ──────────────────────── */

describe("fallbackAnalysis", () => {
  it("returns an honest empty analysis with no insights, actions or suggestions", () => {
    const { response, suggestions, recoveryAnalysis } = fallbackAnalysis(makeCtx(), "conservative");
    expect(response.insights).toEqual([]);
    expect(response.suggestedActions).toEqual([]);
    expect(suggestions).toEqual([]);
    expect(response.explainability.confidence).toBe(0);
    expect(response.explainability.expectedImpact).toMatch(/unavailable/i);
    expect(response.autonomyLevel).toBe("conservative");
    expect(recoveryAnalysis.burnoutDetected).toBe(false);
  });
});

/* ── Response parsing + self-correction (gemini.ts) ────────── */

describe("processResponse", () => {
  const VALID = JSON.stringify({
    summary: { status: "healthy", headline: "All good", keyMetrics: {} },
    insights: [{ type: "overload", severity: "warning", title: "Busy", detail: "Too dense", confidence: 0.8 }],
    suggestedActions: [{ action: "add_recovery", params: {}, reason: "rest", impact: "calmer", confidence: 0.7 }],
    suggestions: [{ type: "recovery", title: "Add a break", detail: "15 min", priority: "high", actionable: true }],
    recoveryAnalysis: { recoveryScore: 50, sustainableScore: 60, overloadDetected: false, burnoutDetected: false, recommendations: [] },
    explainability: { reasoning: [], affectedGoals: [], affectedBlocks: [], affectedMetrics: [], expectedImpact: "x", confidence: 0.6 },
  });

  it("extracts insights, actions and suggestions from a valid response", () => {
    const r = processResponse(VALID, makeCtx(), "balanced");
    expect(r.response.insights).toHaveLength(1);
    expect(r.response.suggestedActions[0].action).toBe("add_recovery");
    expect(r.suggestions).toHaveLength(1);
    expect(r.response.autonomyLevel).toBe("balanced");
  });

  it("strips ```json fences before parsing", () => {
    const r = processResponse("```json\n" + VALID + "\n```", makeCtx(), "balanced");
    expect(r.response.summary.headline).toBe("All good");
  });

  it("self-corrects a structurally incomplete response instead of throwing", () => {
    const r = processResponse("{}", makeCtx(), "aggressive");
    expect(r.response.insights).toEqual([]);
    expect(r.response.suggestedActions).toEqual([]);
    expect(r.response.summary).toBeDefined();
  });

  it("throws on non-JSON text (caller catches → fallback)", () => {
    expect(() => processResponse("totally not json", makeCtx(), "balanced")).toThrow();
  });
});

/* ── Structure validation + self-correction (selfCorrection.ts) ─ */

describe("validateResponseStructure", () => {
  it("accepts a well-formed object", () => {
    expect(validateResponseStructure({ summary: {}, insights: [], suggestedActions: [] }).valid).toBe(true);
  });
  it("rejects non-objects and missing fields", () => {
    expect(validateResponseStructure(null).valid).toBe(false);
    const r = validateResponseStructure({ insights: "no" });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Missing summary");
  });
});

describe("selfCorrectResponse", () => {
  it("fills every missing field and records the changes", () => {
    const { corrected, changes } = selfCorrectResponse({}, { blockCount: 0, goalCount: 0 });
    expect(corrected.summary).toBeDefined();
    expect(corrected.insights).toEqual([]);
    expect(corrected.suggestedActions).toEqual([]);
    expect(corrected.explainability).toBeDefined();
    expect(changes.length).toBe(4);
  });

  it("leaves a complete response untouched", () => {
    const complete = {
      summary: { status: "healthy", headline: "ok", keyMetrics: {} },
      insights: [], suggestedActions: [],
      explainability: { reasoning: [], affectedGoals: [], affectedBlocks: [], affectedMetrics: [], expectedImpact: "", confidence: 0.5 },
    };
    expect(selfCorrectResponse(complete, { blockCount: 1, goalCount: 1 }).changes).toHaveLength(0);
  });
});

/* ── Confidence scoring (confidence.ts) ────────────────────── */

describe("scoreConfidence / interpretConfidence", () => {
  it("scores a fresh, complete, error-free context as high", () => {
    const score = scoreConfidence({
      contextFreshnessMs: 1000, blockCount: 8, goalCount: 3,
      hasSleepData: true, hasHistoricalData: true, validationErrors: 0, validationWarnings: 0,
    });
    expect(score).toBe(1);
    expect(interpretConfidence(score)).toBe("high");
  });

  it("clamps to 0 for a stale, empty, error-laden context", () => {
    const score = scoreConfidence({
      contextFreshnessMs: 7_200_000, blockCount: 0, goalCount: 0,
      hasSleepData: false, hasHistoricalData: false, validationErrors: 5, validationWarnings: 5,
    });
    expect(score).toBe(0);
    expect(interpretConfidence(score)).toBe("low");
  });

  it("maps the medium band", () => {
    expect(interpretConfidence(0.5)).toBe("medium");
    expect(interpretConfidence(0.79)).toBe("medium");
  });
});

/* ── Explainability (explainability.ts) ────────────────────── */

describe("buildExplainability", () => {
  it("reports a stable schedule when there are no actions", () => {
    const r = buildExplainability(makeCtx(), [], []);
    expect(r.expectedImpact).toMatch(/stable/i);
    expect(r.confidence).toBe(0);
  });

  it("summarises proposed actions and averages confidence with data confidence", () => {
    const actions = [action("add_block", 0.6)];
    const insights: Insight[] = [{ type: "overload", severity: "critical", title: "X", detail: "d", confidence: 0.9 }];
    const r = buildExplainability(makeCtx(), insights, actions, 0.8);
    expect(r.expectedImpact).toMatch(/action\(s\) proposed/);
    expect(r.reasoning).toContain("d");
    expect(r.confidence).toBeCloseTo(0.7); // (0.8 data + 0.6 action) / 2
  });

  it("links goal-typed insights back to a matching goal", () => {
    const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00" })], goals: [goal("deep", { title: "Ship it" })] });
    const insights: Insight[] = [{ type: "goal_neglected", severity: "warning", title: "Ship it", detail: "behind", confidence: 0.7 }];
    const r = buildExplainability(ctx, insights, []);
    expect(r.affectedGoals).toContain("Ship it");
  });
});
