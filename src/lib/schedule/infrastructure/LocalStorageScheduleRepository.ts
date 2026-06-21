import type { ScheduleData } from "../types";
import type { ScheduleRepository } from "../ports/ScheduleRepository";
import { STORAGE_KEY, LEGACY_STORAGE_KEYS } from "../ports/ScheduleRepository";

export class LocalStorageScheduleRepository implements ScheduleRepository {
  loadRaw(): ScheduleData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
        ?? LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
        ?? null;
      if (raw) {
        return JSON.parse(raw) as ScheduleData;
      }
    } catch {
      return null;
    }
    return null;
  }

  save(data: ScheduleData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // storage full or unavailable
    }
  }

  hasData(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null
        || LEGACY_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      for (const key of LEGACY_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
    } catch {
      // storage unavailable
    }
  }
}
