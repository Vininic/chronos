/**
 * The Kairos → Chronos bridge.
 *
 * Kairos posts scheduling requests into the shared `user_data` table (key
 * "kairos-bridge") when the user asks to "Send to Chronos" from a task.
 * Chronos never writes Kairos' board — it only reads this inbox, turns a
 * request into a commitment on its own terms, and marks it scheduled.
 * Mirrors the shape of `lib/sync/userDataSync.ts` but is one-directional and
 * single-domain, so it's kept separate rather than added to SYNCED_DOMAINS.
 */
import { getSupabaseClient } from "@/lib/supabase/client";

const TABLE = "user_data";
const BRIDGE_KEY = "kairos-bridge";

export interface BridgeRequest {
  id: string;
  taskId: string;
  projectName: string;
  title: string;
  notes?: string;
  dueDate?: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  durationMin: number;
  createdAt: string;
  status: "pending" | "scheduled" | "dismissed";
  commitmentId?: string;
}

interface BridgeData {
  version: 1;
  requests: BridgeRequest[];
}

function coerce(raw: unknown): BridgeData {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as BridgeData).requests)) {
    return { version: 1, requests: [] };
  }
  return { version: 1, requests: (raw as BridgeData).requests };
}

async function currentUserId(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.user?.id ?? null;
}

/** Pending requests waiting for a slot on the calendar. Empty when signed out
 *  or local-only (the bridge only exists for cloud accounts). */
export async function fetchPendingRequests(): Promise<BridgeRequest[]> {
  const sb = getSupabaseClient();
  const userId = await currentUserId();
  if (!sb || !userId) return [];
  const { data, error } = await sb
    .from(TABLE)
    .select("value")
    .eq("user_id", userId)
    .eq("key", BRIDGE_KEY)
    .maybeSingle();
  if (error || !data) return [];
  return coerce(data.value).requests.filter((r) => r.status === "pending");
}

async function patchRequest(id: string, patch: Partial<BridgeRequest>): Promise<void> {
  const sb = getSupabaseClient();
  const userId = await currentUserId();
  if (!sb || !userId) return;
  const { data } = await sb.from(TABLE).select("value").eq("user_id", userId).eq("key", BRIDGE_KEY).maybeSingle();
  const bridge = coerce(data?.value);
  bridge.requests = bridge.requests.map((r) => (r.id === id ? { ...r, ...patch } : r));
  await sb.from(TABLE).upsert({ user_id: userId, key: BRIDGE_KEY, value: bridge, version: Date.now() }, { onConflict: "user_id,key" });
}

export function markScheduled(id: string, commitmentId?: string): Promise<void> {
  return patchRequest(id, { status: "scheduled", commitmentId });
}

export function dismissRequest(id: string): Promise<void> {
  return patchRequest(id, { status: "dismissed" });
}
