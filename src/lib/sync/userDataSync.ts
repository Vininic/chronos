/**
 * Generic localStorage ⇄ Supabase sync engine.
 *
 * The schedule has its own repository (key="schedule"); this engine mirrors the
 * *other* user-owned stores into the same `user_data` KV table, one row per domain.
 * It is intentionally non-invasive: it snapshots the synced localStorage keys and
 * pushes the diff on a debounce, instead of rewriting each store to be async.
 *
 * Security: AI API keys NEVER leave the device — `sanitizeForPush` strips them
 * before upload and `mergeOnPull` keeps the local keys on download.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";

const TABLE = "user_data";
const RELOAD_GUARD = "chronos.sync.pulled"; // sessionStorage flag: reload at most once/login

export interface SyncedDomain {
  /** row key in user_data */
  key: string;
  /** the localStorage key it mirrors */
  storageKey: string;
}

export const SYNCED_DOMAINS: SyncedDomain[] = [
  { key: "learning", storageKey: "chronos.learning.v1" },
  { key: "chat", storageKey: "chronos.chat.v1" },
  { key: "digests", storageKey: "chronos.digest-store.v1" },
  { key: "daily-log", storageKey: "chronos.daily-log" },
  { key: "settings", storageKey: "chronos.ai-settings.v1" },
];

/* ── Pure helpers (the API-key carve-out) — exported for tests ─────────────── */

/** Strip secrets before upload. AI provider keys stay on-device only. */
export function sanitizeForPush(domainKey: string, value: unknown): unknown {
  if (domainKey === "settings" && value && typeof value === "object") {
    return { ...(value as Record<string, unknown>), apiKeys: {} };
  }
  return value;
}

/** On download, keep the device's local API keys (the remote row never has them). */
export function mergeOnPull(domainKey: string, remote: unknown, localRaw: string | null): unknown {
  if (domainKey === "settings" && remote && typeof remote === "object") {
    let localKeys: unknown = {};
    try {
      localKeys = localRaw ? (JSON.parse(localRaw) as { apiKeys?: unknown }).apiKeys ?? {} : {};
    } catch {
      /* ignore */
    }
    return { ...(remote as Record<string, unknown>), apiKeys: localKeys };
  }
  return remote;
}

/* ── Engine ────────────────────────────────────────────────────────────────── */

const snapshot = new Map<string, string | null>();
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const ownVersions = new Set<number>(); // versions WE wrote — used to ignore our own realtime echoes

async function currentUserId(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.user?.id ?? null;
}

/** Pull every synced domain into localStorage. Returns true if anything changed. */
export async function pullAll(): Promise<boolean> {
  const sb = getSupabaseClient();
  const userId = await currentUserId();
  if (!sb || !userId) return false;

  const { data, error } = await sb
    .from(TABLE)
    .select("key, value")
    .eq("user_id", userId)
    .in("key", SYNCED_DOMAINS.map((d) => d.key));
  if (error || !data) return false;

  let changed = false;
  for (const row of data as { key: string; value: unknown }[]) {
    const domain = SYNCED_DOMAINS.find((d) => d.key === row.key);
    if (!domain) continue;
    const localRaw = localStorage.getItem(domain.storageKey);
    const next = JSON.stringify(mergeOnPull(domain.key, row.value, localRaw));
    if (next !== localRaw) {
      localStorage.setItem(domain.storageKey, next);
      changed = true;
    }
    snapshot.set(domain.storageKey, localStorage.getItem(domain.storageKey));
  }
  return changed;
}

async function pushDomain(domain: SyncedDomain): Promise<void> {
  const sb = getSupabaseClient();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  const raw = localStorage.getItem(domain.storageKey);
  if (raw === null) return;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return;
  }
  const version = Date.now();
  ownVersions.add(version);
  await sb
    .from(TABLE)
    .upsert(
      { user_id: userId, key: domain.key, value: sanitizeForPush(domain.key, value), version },
      { onConflict: "user_id,key" },
    );
}

/** Watch this user's rows for changes made on OTHER devices and notify. (Our own
 *  writes are ignored via `ownVersions`.) Returns an unsubscribe fn. */
export function subscribeForeignChanges(userId: string, onForeign: () => void): () => void {
  const sb = getSupabaseClient();
  if (!sb) return () => {};
  const channel = sb
    .channel("user_data_sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { key?: string; version?: number } | undefined;
        if (!row?.key || !SYNCED_DOMAINS.some((d) => d.key === row.key)) return; // ignore schedule etc.
        if (typeof row.version === "number" && ownVersions.has(row.version)) return; // our own echo
        onForeign();
      },
    )
    .subscribe();
  return () => { sb.removeChannel(channel); };
}

/** Diff synced keys against the last snapshot; debounce-push the ones that changed. */
export function flushChanges(): void {
  for (const domain of SYNCED_DOMAINS) {
    const raw = localStorage.getItem(domain.storageKey);
    if (raw === (snapshot.get(domain.storageKey) ?? null)) continue;
    snapshot.set(domain.storageKey, raw);
    const existing = pushTimers.get(domain.key);
    if (existing) clearTimeout(existing);
    pushTimers.set(domain.key, setTimeout(() => pushDomain(domain), 1000));
  }
}

/** Mount once at the app root. Pulls on login, then pushes local changes. */
export function useSyncEngine(): void {
  const { session, isCloud } = useAuth();

  useEffect(() => {
    // Only sync for a real cloud account (signed in with an email) — never for a
    // local guest session, even when a Supabase project is configured.
    if (!isCloud || !session?.email) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const changed = await pullAll();
      // The React stores read localStorage on mount, so a fresh pull only shows
      // after a reload — do it once per login when remote actually differed.
      if (changed && !sessionStorage.getItem(RELOAD_GUARD)) {
        sessionStorage.setItem(RELOAD_GUARD, "1");
        window.location.reload();
        return;
      }
      if (cancelled) return;
      // Seed the snapshot so we only push genuine post-login edits.
      for (const d of SYNCED_DOMAINS) snapshot.set(d.storageKey, localStorage.getItem(d.storageKey));
      interval = setInterval(flushChanges, 3000);

      // Live convergence: another device's edit prompts a reload-to-pull.
      const userId = await currentUserId();
      if (userId && !cancelled) {
        unsubscribe = subscribeForeignChanges(userId, () => {
          toast("Updated on another device", {
            description: "Reload to pull the latest changes.",
            action: { label: "Reload", onClick: () => window.location.reload() },
          });
        });
      }
    })();

    const flush = () => flushChanges();
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      unsubscribe?.();
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [isCloud, session?.email]);
}
