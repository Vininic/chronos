import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "chronos.supabase.config";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

function envConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

export function loadSupabaseConfig(): SupabaseConfig | null {
  // A user-supplied (BYO) project overrides the hosted default; otherwise fall back
  // to the build-time env project so a hosted deploy connects out of the box.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SupabaseConfig;
  } catch {
    /* ignore */
  }
  return envConfig();
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
