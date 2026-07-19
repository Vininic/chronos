import { describe, it, expect } from "vitest";
import { extractProposedCalls } from "@/lib/ai/chat/service";
import { extractProposedBlockData } from "@/components/chat/BlockPill";
import type { ScheduleData } from "@/lib/schedule/types";

function baseData(over: Partial<ScheduleData> = {}): ScheduleData {
  return {
    meta: {
      version: 5,
      owner: "T",
      cycle: { name: "C", number: 1, week: 1, progress: 0 },
      workdayStart: "07:00",
      workdayEnd: "19:00",
    },
    categories: [{ id: "deep", label: "Deep", tone: "bronze" }],
    routine: [{ id: "b1", day: 1, start: "09:00", end: "10:00", kind: "deep", title: "Focus block" }],
    commitments: [{ id: "c1", start: "14:00", end: "14:30", kind: "meeting", title: "Standup" }],
    presets: [],
    suggestions: [],
    goals: [],
    ledger: { compositionScore: 0, metrics: [], scheduledHours: [0, 0, 0, 0, 0, 0, 0] },
    progressSnapshots: [],
    ...over,
  } as unknown as ScheduleData;
}

/* ── Parsing (pure, mirrors extractToolCalls' own tests) ────────────── */

describe("extractProposedCalls", () => {
  it("parses a single [PROPOSE:...] tag with JSON params", () => {
    const calls = extractProposedCalls('[PROPOSE:createBlock]{"title":"Focus","start":"10:00","end":"11:00","category":"deep"}[/PROPOSE]');
    expect(calls).toEqual([
      { tool: "createBlock", params: { title: "Focus", start: "10:00", end: "11:00", category: "deep" } },
    ]);
  });

  it("parses multiple tags interleaved with prose", () => {
    const text = 'I\'d remove the redundant block and add a new one.\n\n[PROPOSE:deleteBlock]{"blockId":"b1"}[/PROPOSE]\n[PROPOSE:createBlock]{"title":"New","start":"10:00","end":"11:00"}[/PROPOSE]';
    const calls = extractProposedCalls(text);
    expect(calls.map((c) => c.tool)).toEqual(["deleteBlock", "createBlock"]);
  });

  it("falls back to raw params on malformed JSON instead of throwing", () => {
    const calls = extractProposedCalls("[PROPOSE:weird]not json[/PROPOSE]");
    expect(calls[0]).toEqual({ tool: "weird", params: { raw: "not json" } });
  });

  it("returns [] when there are no PROPOSE tags", () => {
    expect(extractProposedCalls("Looks good, no changes needed.")).toEqual([]);
  });

  it("does not pick up real [TOOL:...] tags", () => {
    expect(extractProposedCalls('[TOOL:createBlock]{"title":"X"}[/TOOL]')).toEqual([]);
  });
});

/* ── Mapping proposed calls to pill data (real semantics, not text guessing) ── */

describe("extractProposedBlockData", () => {
  it("maps createBlock/addCommitment straight from params", () => {
    const calls = [{ tool: "createBlock", params: { title: "Focus", start: "10:00", end: "11:00", category: "deep" } }];
    const blocks = extractProposedBlockData(calls, baseData());
    expect(blocks).toEqual([
      { title: "Focus", start: "10:00", end: "11:00", kind: "deep", categories: expect.any(Array), action: "added" },
    ]);
  });

  it("resolves deleteBlock's blockId to the real block's title/time from data — nothing has executed yet, so there's no result to read it from", () => {
    const calls = [{ tool: "deleteBlock", params: { blockId: "b1" } }];
    const blocks = extractProposedBlockData(calls, baseData());
    expect(blocks).toEqual([
      { title: "Focus block", start: "09:00", end: "10:00", kind: "deep", categories: expect.any(Array), action: "removed" },
    ]);
  });

  it("resolves removeCommitment by commitmentId", () => {
    const calls = [{ tool: "removeCommitment", params: { commitmentId: "c1" } }];
    const blocks = extractProposedBlockData(calls, baseData());
    expect(blocks[0]).toMatchObject({ title: "Standup", action: "removed" });
  });

  it("applies updateBlock's patch over the existing block for preview", () => {
    const calls = [{ tool: "updateBlock", params: { blockId: "b1", patch: { start: "11:00", end: "12:00" } } }];
    const blocks = extractProposedBlockData(calls, baseData());
    expect(blocks[0]).toMatchObject({ title: "Focus block", start: "11:00", end: "12:00", action: "modified" });
  });

  it("applies moveBlock's newStart/newEnd for preview", () => {
    const calls = [{ tool: "moveBlock", params: { blockId: "b1", newStart: "13:00", newEnd: "14:00" } }];
    const blocks = extractProposedBlockData(calls, baseData());
    expect(blocks[0]).toMatchObject({ title: "Focus block", start: "13:00", end: "14:00", action: "modified" });
  });

  it("skips a call referencing a block id that doesn't exist, instead of throwing", () => {
    const calls = [{ tool: "deleteBlock", params: { blockId: "ghost" } }];
    expect(extractProposedBlockData(calls, baseData())).toEqual([]);
  });

  it("returns [] without data (nothing to resolve titles against)", () => {
    const calls = [{ tool: "deleteBlock", params: { blockId: "b1" } }];
    expect(extractProposedBlockData(calls, undefined)).toEqual([]);
  });
});
