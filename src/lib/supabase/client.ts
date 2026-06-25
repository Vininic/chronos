import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "chronos.supabase.config";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function loadSupabaseConfig(): SupabaseConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SupabaseConfig;
  } catch {
    return null;
  }
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasSupabaseConfig(): boolean {
  return loadSupabaseConfig() !== null;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const config = loadSupabaseConfig();
  if (!config) return null;
  cachedClient = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, storageKey: "chronos.supabase.auth" },
  });
  return cachedClient;
}

export function clearSupabaseClient(): void {
  cachedClient = null;
}
