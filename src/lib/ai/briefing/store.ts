export const LAST_VISIT_KEY = "chronos.last-visit-date";
export const BRIEFING_KEY = "chronos.daily-briefing";

export function getLastVisitDate(): string | null {
  try {
    return localStorage.getItem(LAST_VISIT_KEY);
  } catch {
    return null;
  }
}

export function setLastVisitDate(date: string): void {
  try {
    localStorage.setItem(LAST_VISIT_KEY, date);
  } catch {}
}

export function isNewDay(): boolean {
  const last = getLastVisitDate();
  const today = new Date().toISOString().slice(0, 10);
  return last !== today;
}

export function getStoredBriefing(): string | null {
  try {
    return localStorage.getItem(BRIEFING_KEY);
  } catch {
    return null;
  }
}

export function setStoredBriefing(text: string): void {
  try {
    localStorage.setItem(BRIEFING_KEY, text);
  } catch {}
}

export function clearStoredBriefing(): void {
  try {
    localStorage.removeItem(BRIEFING_KEY);
  } catch {}
}
