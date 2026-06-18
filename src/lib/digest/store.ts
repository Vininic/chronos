import type { Digest, DigestMode, DigestStoreData } from "./types";

const STORAGE_KEY = "chronos.digest-store.v1";

function load(): DigestStoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { digests: [], settings: { mode: "auto", lastGeneratedDate: null } };
}

function save(store: DigestStoreData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export function getDigestMode(): DigestMode {
  return load().settings.mode;
}

export function setDigestMode(mode: DigestMode): void {
  const store = load();
  store.settings.mode = mode;
  save(store);
}

export function getLatestDigest(): Digest | null {
  const store = load();
  return store.digests.length > 0 ? store.digests[store.digests.length - 1] : null;
}

export function getDigestByDate(date: string): Digest | null {
  const store = load();
  return store.digests.find((d) => d.date === date) ?? null;
}

export function getAllDigests(): Digest[] {
  const store = load();
  return [...store.digests].reverse();
}

export function addDigest(digest: Digest): void {
  const store = load();
  const idx = store.digests.findIndex((d) => d.date === digest.date && d.timeframe === digest.timeframe);
  if (idx >= 0) {
    store.digests[idx] = digest;
  } else {
    store.digests.push(digest);
    store.digests.sort((a, b) => a.date.localeCompare(b.date));
  }
  store.settings.lastGeneratedDate = digest.date;
  save(store);
}

export function clearDigests(): void {
  const store = load();
  store.digests = [];
  save(store);
}
