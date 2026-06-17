export const LOG_STORAGE_KEY = "chronos.ai-logs.v1";

export interface SelfEvalScore {
  helpfulness: number;
  accuracy: number;
  overall: number;
  summary: string;
}

export interface LLMCallLog {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  promptVersion: string;
  promptHash: string;
  promptPreview: string;
  responsePreview: string;
  latencyMs: number;
  tokenEstimate: number;
  selfEval?: SelfEvalScore;
}

interface LogStore {
  calls: LLMCallLog[];
}

function load(): LogStore {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { calls: [] };
}

function save(store: LogStore): void {
  try {
    const entries = store.calls.slice(-500);
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify({ calls: entries }));
  } catch {}
}

let callId = 0;

export function recordLLMCall(
  provider: string,
  model: string,
  promptVersion: string,
  prompt: string,
  response: string,
  latencyMs: number,
  selfEval?: SelfEvalScore,
): void {
  const store = load();
  store.calls.push({
    id: `log-${Date.now()}-${++callId}`,
    timestamp: new Date().toISOString(),
    provider,
    model,
    promptVersion,
    promptHash: simpleHash(prompt),
    promptPreview: prompt.slice(0, 200),
    responsePreview: response.slice(0, 200),
    latencyMs,
    tokenEstimate: Math.round((prompt.length + response.length) / 4),
    selfEval,
  });
  save(store);
}

export function getLogs(): LLMCallLog[] {
  return load().calls;
}

export function clearLogs(): void {
  save({ calls: [] });
}

function simpleHash(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}
