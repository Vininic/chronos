import type { ScheduleData } from "../schedule/types";
import type { ScheduleRepository } from "../schedule/ports/ScheduleRepository";
import { STORAGE_KEY as LOCAL_STORAGE_KEY, LEGACY_STORAGE_KEYS } from "../schedule/ports/ScheduleRepository";
import { getSupabaseClient } from "./client";

const TABLE = "user_data";
const KEY = "schedule"; // the schedule is one row in the generic user_data KV table

export class SupabaseScheduleRepository implements ScheduleRepository {
  async loadRaw(): Promise<ScheduleData | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.fallbackToLocal();

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return this.fallbackToLocal();

    const { data, error } = await supabase
      .from(TABLE)
      .select("value")
      .eq("user_id", userId)
      .eq("key", KEY)
      .maybeSingle();

    if (error) return this.fallbackToLocal();
    return (data?.value as ScheduleData) ?? this.fallbackToLocal();
  }

  async save(data: ScheduleData): Promise<void> {
    // Always mirror locally first so an offline reload (PWA) still has the latest.
    this.saveLocal(data);

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    // `version` is a monotonic client stamp used by the realtime echo-guard (Phase D);
    // `updated_at` is set server-side by the touch trigger.
    await supabase
      .from(TABLE)
      .upsert({ user_id: userId, key: KEY, value: data, version: Date.now() }, { onConflict: "user_id,key" });
  }

  async hasData(): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.hasLocal();

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return this.hasLocal();

    const { count, error } = await supabase
      .from(TABLE)
      .select("key", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("key", KEY);

    if (error || count === null) return this.hasLocal();
    return count > 0;
  }

  async clear(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      this.clearLocal();
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (userId) {
      await supabase.from(TABLE).delete().eq("user_id", userId).eq("key", KEY);
    }
    this.clearLocal();
  }

  private fallbackToLocal(): ScheduleData | null {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
        ?? LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
        ?? null;
      if (raw) return JSON.parse(raw) as ScheduleData;
    } catch { /* ignore */ }
    return null;
  }

  private saveLocal(data: ScheduleData): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage full */ }
  }

  private hasLocal(): boolean {
    try {
      return localStorage.getItem(LOCAL_STORAGE_KEY) !== null
        || LEGACY_STORAGE_KEYS.some((key) => localStorage.getItem(key) !== null);
    } catch {
      return false;
    }
  }

  private clearLocal(): void {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
    } catch { /* ignore */ }
  }
}
