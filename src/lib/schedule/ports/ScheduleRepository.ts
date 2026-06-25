import type { ScheduleData } from "../types";

export const SCHEMA_VERSION = 5;
export const STORAGE_KEY = "chronos.schedule.v5";
export const LEGACY_STORAGE_KEYS = ["chronos.schedule.v4", "chronos.schedule.v3", "chronos.schedule.v2", "chronos.schedule.v1"] as const;

export interface ScheduleRepository {
  loadRaw(): Promise<ScheduleData | null>;
  save(data: ScheduleData): Promise<void>;
  hasData(): Promise<boolean>;
  clear(): Promise<void>;
}
