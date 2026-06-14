export function scoreConfidence(factors: {
  contextFreshnessMs: number;
  blockCount: number;
  goalCount: number;
  hasSleepData: boolean;
  hasHistoricalData: boolean;
  validationErrors: number;
  validationWarnings: number;
}): number {
  let score = 1;

  if (factors.contextFreshnessMs > 300_000) score -= 0.1;
  if (factors.contextFreshnessMs > 3_600_000) score -= 0.15;

  if (factors.blockCount === 0) score -= 0.2;
  if (factors.goalCount === 0) score -= 0.1;
  if (!factors.hasSleepData) score -= 0.1;
  if (!factors.hasHistoricalData) score -= 0.1;
  score -= factors.validationErrors * 0.1;
  score -= factors.validationWarnings * 0.05;

  return Math.max(0, Math.min(1, score));
}

export function interpretConfidence(score: number): "low" | "medium" | "high" {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}
