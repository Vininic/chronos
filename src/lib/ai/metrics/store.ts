export const METRICS_STORAGE_KEY = "chronos.ai-metrics.v1";

export interface SuggestionFeedback {
  suggestionId: string;
  vote: "up" | "down";
  timestamp: string;
}

interface MetricsStore {
  suggestionFeedback: SuggestionFeedback[];
}

function load(): MetricsStore {
  try {
    const raw = localStorage.getItem(METRICS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { suggestionFeedback: [] };
}

function save(store: MetricsStore): void {
  try {
    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function recordSuggestionFeedback(suggestionId: string, vote: "up" | "down"): void {
  const store = load();
  const existing = store.suggestionFeedback.findIndex(
    (f) => f.suggestionId === suggestionId,
  );
  const entry: SuggestionFeedback = { suggestionId, vote, timestamp: new Date().toISOString() };
  if (existing >= 0) {
    store.suggestionFeedback[existing] = entry;
  } else {
    store.suggestionFeedback.push(entry);
  }
  save(store);
}

export function getSuggestionFeedback(suggestionId: string): "up" | "down" | null {
  const store = load();
  return store.suggestionFeedback.find((f) => f.suggestionId === suggestionId)?.vote ?? null;
}

export function getAllFeedback(): SuggestionFeedback[] {
  return load().suggestionFeedback;
}

export function clearAllFeedback(): void {
  save({ suggestionFeedback: [] });
}
