import type { AetherisResponse } from "./schemas";

export interface CorrectionResult {
  original: AetherisResponse;
  corrected: AetherisResponse;
  changes: string[];
}

export function validateResponseStructure(raw: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== "object") {
    errors.push("Response must be an object");
    return { valid: false, errors };
  }

  const r = raw as Record<string, unknown>;
  if (!r.summary) errors.push("Missing summary");
  if (!Array.isArray(r.insights)) errors.push("insights must be an array");
  if (!Array.isArray(r.suggestedActions)) errors.push("suggestedActions must be an array");

  return { valid: errors.length === 0, errors };
}

export function selfCorrectResponse(
  raw: unknown,
  _context: { blockCount: number; goalCount: number },
): CorrectionResult {
  const original = raw as AetherisResponse;
  const corrected = { ...original };
  const changes: string[] = [];

  if (!corrected.summary) {
    corrected.summary = {
      status: "attention",
      headline: "Could not generate summary — using defaults",
      keyMetrics: {},
    };
    changes.push("Added missing summary");
  }

  if (!Array.isArray(corrected.insights)) {
    corrected.insights = [];
    changes.push("Replaced missing/non-array insights with empty array");
  }

  if (!Array.isArray(corrected.suggestedActions)) {
    corrected.suggestedActions = [];
    changes.push("Replaced missing/non-array suggestedActions with empty array");
  }

  if (!corrected.explainability) {
    corrected.explainability = {
      reasoning: [],
      affectedGoals: [],
      affectedBlocks: [],
      affectedMetrics: [],
      expectedImpact: "",
      confidence: 0.5,
    };
    changes.push("Added missing explainability");
  }

  return { original, corrected, changes };
}
