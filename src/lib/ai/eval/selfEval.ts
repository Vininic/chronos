import type { LLMCallLog } from "../core/logger";

export interface SelfEvalScore {
  helpfulness: number;
  accuracy: number;
  overall: number;
  summary: string;
}

export function evaluateResponse(
  promptPreview: string,
  responseText: string,
  toolCalls: Array<{ tool: string; error?: string }>,
): SelfEvalScore {
  const scores: number[] = [];

  // 1. Tool success rate
  if (toolCalls.length > 0) {
    const successRate = toolCalls.filter((t) => !t.error).length / toolCalls.length;
    scores.push(successRate);
  }

  // 2. Response length appropriateness (not empty, not absurdly long)
  const wordCount = responseText.split(/\s+/).filter(Boolean).length;
  if (wordCount < 3) {
    scores.push(0);
  } else if (wordCount > 500) {
    scores.push(0.6);
  } else if (wordCount > 10) {
    scores.push(0.9);
  } else {
    scores.push(0.5);
  }

  // 3. Has substance (contains actionable content vs. just filler)
  const hasActionable = /suggest|recommend|try|consider|move|add|change|adjust|create|delete|split|merge/i.test(responseText);
  scores.push(hasActionable ? 0.9 : 0.4);

  // 4. No hallucination indicators (doesn't invent things)
  const hallucinationIndicators = /i think there might be|perhaps there is|maybe there's a block/i.test(responseText);
  scores.push(hallucinationIndicators ? 0.3 : 0.95);

  // 5. Has reasoning (explains before acting)
  const hasReasoning = /because|since|this means|as a result|to help|so that/i.test(responseText);
  scores.push(hasReasoning ? 0.85 : 0.5);

  const overall = scores.reduce((a, b) => a + b, 0) / scores.length;

  // Scores layout (when all 5 present):
  // 0=toolSuccess, 1=length, 2=substance, 3=hallucination, 4=reasoning
  const lengthIdx = toolCalls.length > 0 ? 1 : 0;
  const substanceIdx = lengthIdx + 1;
  const hallucinationIdx = substanceIdx + 1;
  const reasoningIdx = hallucinationIdx + 1;

  const hasLength = lengthIdx < scores.length;
  const hasSubstance = substanceIdx < scores.length;
  const hasHallucination = hallucinationIdx < scores.length;
  const hasReasoningScore = reasoningIdx < scores.length;

  const helpSum = (hasLength ? scores[lengthIdx] : 0)
    + (hasSubstance ? scores[substanceIdx] : 0)
    + (hasReasoningScore ? scores[reasoningIdx] : 0);
  const helpCount = (hasLength ? 1 : 0) + (hasSubstance ? 1 : 0) + (hasReasoningScore ? 1 : 0);

  const accSum = (toolCalls.length > 0 ? scores[0] : 0)
    + (hasHallucination ? scores[hallucinationIdx] : 0);
  const accCount = (toolCalls.length > 0 ? 1 : 0) + (hasHallucination ? 1 : 0);

  const helpfulness = helpCount > 0 ? helpSum / helpCount : 0;
  const accuracy = accCount > 0 ? accSum / accCount : 0;

  const summary = overall >= 0.8
    ? "Strong response with actionable suggestions and clear reasoning."
    : overall >= 0.5
    ? "Decent response, could be more specific or actionable."
    : "Response needs improvement — too vague or lacks substance.";

  return {
    helpfulness: Math.round(helpfulness * 100),
    accuracy: Math.round(accuracy * 100),
    overall: Math.round(overall * 100),
    summary,
  };
}

export function trackSelfEval(log: LLMCallLog, evalScore: SelfEvalScore): LLMCallLog {
  return {
    ...log,
    selfEval: evalScore,
  };
}
