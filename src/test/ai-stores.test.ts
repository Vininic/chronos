import { describe, it, expect, beforeEach } from "vitest";
import { addAuditEntry, getAuditLog, markUndone, clearAuditLog, describeToolCall } from "@/lib/ai/audit/store";
import { recordSuggestionFeedback, getSuggestionFeedback, getAllFeedback, clearAllFeedback } from "@/lib/ai/metrics/store";
import { setLastVisitDate, getLastVisitDate, isNewDay, setStoredBriefing, getStoredBriefing, clearStoredBriefing } from "@/lib/ai/briefing/store";
import type { ScheduleData } from "@/lib/schedule/types";

beforeEach(() => localStorage.clear());

/* ── audit/store.ts ────────────────────────────────────────── */

describe("audit store", () => {
  const entry = { tool: "createBlock", params: { title: "Focus" }, description: "Created", scheduleSnapshot: null, undone: false };

  it("appends an entry with a generated id + timestamp", () => {
    const id = addAuditEntry(entry);
    const log = getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0].id).toBe(id);
    expect(log[0].timestamp).toBeTruthy();
  });

  it("marks an entry undone with a restored snapshot", () => {
    const id = addAuditEntry(entry);
    markUndone(id, { meta: {} } as ScheduleData);
    const e = getAuditLog().find((x) => x.id === id)!;
    expect(e.undone).toBe(true);
    expect(e.scheduleSnapshot).not.toBeNull();
  });

  it("caps the log at 200 entries", () => {
    for (let i = 0; i < 205; i++) addAuditEntry({ ...entry, description: `e${i}` });
    expect(getAuditLog()).toHaveLength(200);
  });

  it("clears the log", () => {
    addAuditEntry(entry);
    clearAuditLog();
    expect(getAuditLog()).toHaveLength(0);
  });

  it("describeToolCall renders human-readable labels", () => {
    expect(describeToolCall("createBlock", { title: "Deep" })).toBe('Created block "Deep"');
    expect(describeToolCall("mergeBlocks", { blockIds: ["a", "b"] })).toContain("Merged 2");
    expect(describeToolCall("mysteryTool", { x: 1 })).toContain("mysteryTool");
  });
});

/* ── metrics/store.ts ──────────────────────────────────────── */

describe("metrics store", () => {
  it("records and reads back a vote", () => {
    recordSuggestionFeedback("s1", "up");
    expect(getSuggestionFeedback("s1")).toBe("up");
  });

  it("overwrites an existing vote rather than duplicating", () => {
    recordSuggestionFeedback("s1", "up");
    recordSuggestionFeedback("s1", "down");
    expect(getSuggestionFeedback("s1")).toBe("down");
    expect(getAllFeedback()).toHaveLength(1);
  });

  it("returns null for an unknown suggestion and clears all", () => {
    recordSuggestionFeedback("s1", "up");
    expect(getSuggestionFeedback("ghost")).toBeNull();
    clearAllFeedback();
    expect(getAllFeedback()).toHaveLength(0);
  });
});

/* ── briefing/store.ts ─────────────────────────────────────── */

describe("briefing store", () => {
  it("round-trips the last-visit date", () => {
    setLastVisitDate("2026-06-24");
    expect(getLastVisitDate()).toBe("2026-06-24");
  });

  it("isNewDay reflects whether today was already visited", () => {
    const today = new Date().toISOString().slice(0, 10);
    setLastVisitDate(today);
    expect(isNewDay()).toBe(false);
    setLastVisitDate("2020-01-01");
    expect(isNewDay()).toBe(true);
  });

  it("stores and clears the briefing text", () => {
    setStoredBriefing("Good morning");
    expect(getStoredBriefing()).toBe("Good morning");
    clearStoredBriefing();
    expect(getStoredBriefing()).toBeNull();
  });
});
