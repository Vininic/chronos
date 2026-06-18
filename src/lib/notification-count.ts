type Listener = (count: number) => void;
let _count = 0;
const listeners = new Set<Listener>();

export function setAetherisCount(count: number) {
  _count = count;
  listeners.forEach((fn) => fn(count));
}

export function getAetherisCount(): number {
  return _count;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Briefing cache — written by generateDailyBriefing, read by digest card
let _latestBriefing = "";

export function setLatestBriefing(text: string) {
  _latestBriefing = text;
  _count = 0;
  listeners.forEach((fn) => fn(0));
}

export function getLatestBriefing(): string {
  return _latestBriefing;
}
