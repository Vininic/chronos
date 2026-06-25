import type { ScheduleData } from "../schedule/types";
import type { ScheduleRepository } from "../schedule/ports/ScheduleRepository";
import { STORAGE_KEY as LOCAL_STORAGE_KEY, LEGACY_STORAGE_KEYS } from "../schedule/ports/ScheduleRepository";
import { getSupabaseClient } from "./client";

const TABLE = "schedules";

export class SupabaseScheduleRepository implements ScheduleRepository {
  async loadRaw(): Promise<ScheduleData | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.fallbackToLocal();

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return this.fallbackToLocal();

    const { data, error } = await supabase
      .from(TABLE)
      .select("data")
      .eq("user_id", userId)
      .single();

    if (error || !data) return this.fallbackToLocal();
    return data.data as ScheduleData;
  }

  async save(data: ScheduleData): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      this.saveLocal(data);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      this.saveLocal(data);
      return;
    }

    const { error } = await supabase
      .from(TABLE)
      .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    if (error) {
      this.saveLocal(data);
    }
  }

  async hasData(): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.hasLocal();

    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return this.hasLocal();

    const { count, error } = await supabase
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

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
      await supabase.from(TABLE).delete().eq("user_id", userId);
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
