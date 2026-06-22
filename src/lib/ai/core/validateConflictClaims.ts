// Deterministic guard against AI-hallucinated scheduling overlaps.
//
// The model sees all routine blocks aggregated across the week and sometimes
// mistakes same-time blocks on different weekdays for real same-time conflicts.
// `optimizeSchedule(...).conflicts` is the authoritative, day-aware overlap
// check (it skips pairs where a.day !== b.day). When that finds ZERO real
// overlaps, any AI output claiming blocks collide in time is a hallucination
// and should be dropped.
//
// This is shared by the digest, the Aetheris pipeline, and any other surface
// that renders AI conflict/overlap claims — reuse it instead of writing another
// regex. The deterministic source of truth is always `optimizeSchedule`.

// Matches time-collision language only. Deliberately excludes a bare "conflict"
// so legitimate non-time insights (e.g. goal_conflict) are never suppressed.
export const TIME_OVERLAP_CLAIM_RE =
  /overlap|simultan|same time|same slot|physically impossible|double-?book|two .{0,24}\bat the same|can'?t .{0,24}\bboth\b/i;

export function claimsTimeOverlap(text: string): boolean {
  return TIME_OVERLAP_CLAIM_RE.test(text);
}

/**
 * Drop AI items that claim time overlaps when the deterministic checker found
 * none. If `realConflictCount > 0` the schedule genuinely has overlaps, so every
 * item is kept untouched.
 *
 * @param getText extracts the searchable text from an item (title + body, etc.)
 */
export function filterHallucinatedConflicts<T>(
  items: T[],
  realConflictCount: number,
  getText: (item: T) => string,
): T[] {
  if (realConflictCount > 0) return items;
  return items.filter((item) => !claimsTimeOverlap(getText(item)));
}
