import type { ScheduleData } from "@/lib/schedule/types";
import { durationMin } from "@/lib/schedule/types";
import { buildAgendaForDate } from "@/lib/schedule/store";

const STORAGE_KEY = "chronos.daily-log";
const RETENTION_DAYS = 90;

export interface DailyLogEntry {
  date: string;       // YYYY-MM-DD
  totalMin: number;
  focusMin: number;
  recoveryMin: number;
  blocks: Array<{ kind: string; title: string; durationMin: number }>;
  capturedAt: string; // ISO timestamp
}

function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function loadDailyLogs(): DailyLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DailyLogEntry[];
  } catch {
    return [];
  }
}

function saveDailyLogs(logs: DailyLogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // localStorage quota exceeded — drop silently
  }
}

export function getLogsInRange(start: string, end: string): DailyLogEntry[] {
  return loadDailyLogs().filter((l) => l.date >= start && l.date <= end);
}

export function getLogsLastNDays(n: number): DailyLogEntry[] {
  const start = addDays(isoToday(), -n);
  return getLogsInRange(start, addDays(isoToday(), -1));
}

/**
 * Called once on app load (inside DashboardLayout useEffect).
 * Walks backward from yesterday to the retention cutoff and captures any
 * missing dates based on the current routine + commitments.
 * Because the routine is weekly-repeating, historical entries reflect what
 * was *scheduled* (not necessarily completed) — still useful for trend analysis.
 */
export function autoCaptureLogs(data: ScheduleData): void {
  const today = isoToday();
  const yesterday = addDays(today, -1);
  const cutoff = addDays(today, -RETENTION_DAYS);
  const focusIds = new Set(data.meta.focusCategoryIds ?? []);
  const recoveryIds = new Set(data.categories.filter((c) => c.role === "recovery").map((c) => c.id));

  // Prune logs older than the retention window
  const existing = loadDailyLogs().filter((l) => l.date >= cutoff);
  const capturedDates = new Set(existing.map((l) => l.date));

  const newEntries: DailyLogEntry[] = [];
  let cursor = cutoff;

  while (cursor <= yesterday) {
    if (!capturedDates.has(cursor)) {
      const date = new Date(cursor + "T12:00:00");
      const agenda = buildAgendaForDate(data, date).filter(
        (a) => a.kind !== "sleep" && !(a as { sleepBoundary?: boolean }).sleepBoundary,
      );

      const blocks = agenda.map((a) => ({
        kind: a.kind,
        title: (a.titleCustom ?? a.title ?? "").slice(0, 60),
        durationMin: durationMin(a.start, a.end),
      }));

      const totalMin = blocks.reduce((s, b) => s + b.durationMin, 0);
      const focusMin = blocks.filter((b) => focusIds.has(b.kind)).reduce((s, b) => s + b.durationMin, 0);
      const recoveryMin = blocks.filter((b) => recoveryIds.has(b.kind)).reduce((s, b) => s + b.durationMin, 0);

      newEntries.push({
        date: cursor,
        totalMin,
        focusMin,
        recoveryMin,
        blocks,
        capturedAt: new Date().toISOString(),
      });
    }
    cursor = addDays(cursor, 1);
  }

  if (newEntries.length > 0 || existing.length < loadDailyLogs().length) {
    saveDailyLogs(
      [...existing, ...newEntries].sort((a, b) => a.date.localeCompare(b.date)),
    );
  }
}
