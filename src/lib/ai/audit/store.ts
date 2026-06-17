import type { ScheduleData } from "@/lib/schedule/types";

export const AUDIT_LOG_KEY = "chronos.audit-log.v1";

export interface AuditEntry {
  id: string;
  timestamp: string;
  tool: string;
  params: Record<string, unknown>;
  description: string;
  scheduleSnapshot: ScheduleData | null;
  undone: boolean;
  undoneAt?: string;
}

interface AuditStore {
  entries: AuditEntry[];
}

function load(): AuditStore {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { entries: [] };
}

function save(store: AuditStore): void {
  try {
    const trimmed = store.entries.slice(-200);
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify({ entries: trimmed }));
  } catch {}
}

export function getAuditLog(): AuditEntry[] {
  return load().entries;
}

export function addAuditEntry(entry: Omit<AuditEntry, "id" | "timestamp">): string {
  const store = load();
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entryWithMeta: AuditEntry = {
    ...entry,
    id,
    timestamp: new Date().toISOString(),
  };
  store.entries.push(entryWithMeta);
  save(store);
  return id;
}

export function markUndone(auditId: string, scheduleSnapshot: ScheduleData): void {
  const store = load();
  store.entries = store.entries.map((e) =>
    e.id === auditId ? { ...e, undone: true, undoneAt: new Date().toISOString(), scheduleSnapshot } : e
  );
  save(store);
}

export function clearAuditLog(): void {
  save({ entries: [] });
}

export function describeToolCall(tool: string, params: Record<string, unknown>): string {
  const name = params.title ?? params.tool ?? tool;
  switch (tool) {
    case "createBlock":
      return `Created block "${name}"`;
    case "updateBlock":
      return `Updated block "${name}"`;
    case "moveBlock":
      return `Moved block "${name}"`;
    case "deleteBlock":
      return `Deleted block "${name}"`;
    case "splitBlock":
      return `Split block at ${String(params.splitTime ?? "")}`;
    case "mergeBlocks":
      return `Merged ${String((params.blockIds as string[])?.length ?? 0)} blocks`;
    case "addCommitment":
      return `Added commitment "${name}"`;
    case "updateCommitment":
      return `Updated commitment "${name}"`;
    case "removeCommitment":
      return `Removed commitment "${name}"`;
    case "addGoal":
      return `Added goal "${name}"`;
    case "updateGoal":
      return `Updated goal "${name}"`;
    case "removeGoal":
      return `Removed goal "${name}"`;
    case "addCategory":
      return `Added category "${(params.label as string) ?? ""}"`;
    case "updateCategory":
      return `Updated category "${(params.label as string) ?? ""}"`;
    case "removeCategory":
      return `Removed category`;
    default:
      return `${tool}(${JSON.stringify(params).slice(0, 80)})`;
  }
}
