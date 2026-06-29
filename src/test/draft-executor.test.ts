import { describe, it, expect } from "vitest";
import { applyDraftToolCall, isDraftSupportedTool } from "@/lib/ai/tools/draftExecutor";
import type { ScheduleData } from "@/lib/schedule/types";

function baseData(over: Partial<ScheduleData> = {}): ScheduleData {
  return {
    meta: {
      version: 5,
      owner: "T",
      cycle: { name: "C", number: 1, week: 1, progress: 0 },
      workdayStart: "07:00",
      workdayEnd: "19:00",
      enforceSleepBoundary: true,
      sleepSchedule: [{ start: "23:00", end: "07:00" }],
    },
    categories: [{ id: "deep", label: "Deep", tone: "bronze" }],
    routine: [],
    commitments: [],
    presets: [],
    suggestions: [],
    goals: [],
    ledger: { compositionScore: 0, metrics: [], scheduledHours: [0, 0, 0, 0, 0, 0, 0] },
    progressSnapshots: [],
    ...over,
  } as unknown as ScheduleData;
}

describe("draft executor — never mutates the input", () => {
  it("returns a new draft and leaves the original untouched", () => {
    const draft = baseData();
    const res = applyDraftToolCall(draft, "createBlock", {
      title: "Focus", start: "09:00", end: "10:00", category: "deep", day: 1,
    });
    expect(res.ok).toBe(true);
    expect(res.draft).not.toBe(draft);
    expect(draft.routine).toHaveLength(0); // original unchanged
    expect(res.draft.routine).toHaveLength(1);
  });
});

describe("draft executor — block tools", () => {
  it("createBlock adds a routine block with the category as kind", () => {
    const res = applyDraftToolCall(baseData(), "createBlock", {
      title: "Focus", start: "09:00", end: "10:00", category: "deep", day: 2,
    });
    expect(res.ok).toBe(true);
    expect(res.draft.routine[0]).toMatchObject({ kind: "deep", day: 2, start: "09:00", end: "10:00" });
  });

  it("createBlock rejects a block overlapping the sleep window", () => {
    const res = applyDraftToolCall(baseData(), "createBlock", {
      title: "Late", start: "23:30", end: "23:45", category: "deep", day: 1,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it("moveBlock relocates an existing block", () => {
    const seeded = applyDraftToolCall(baseData(), "createBlock", {
      title: "Focus", start: "09:00", end: "10:00", category: "deep", day: 1,
    }).draft;
    const id = seeded.routine[0].id;
    const res = applyDraftToolCall(seeded, "moveBlock", { blockId: id, newStart: "11:00", newEnd: "12:00" });
    expect(res.ok).toBe(true);
    expect(res.draft.routine[0]).toMatchObject({ start: "11:00", end: "12:00" });
  });

  it("deleteBlock removes the block, errors on unknown id", () => {
    const seeded = applyDraftToolCall(baseData(), "createBlock", {
      title: "Focus", start: "09:00", end: "10:00", category: "deep", day: 1,
    }).draft;
    const id = seeded.routine[0].id;
    expect(applyDraftToolCall(seeded, "deleteBlock", id).draft.routine).toHaveLength(0);
    expect(applyDraftToolCall(seeded, "deleteBlock", "nope").ok).toBe(false);
  });

  it("splitBlock produces two adjacent blocks", () => {
    const seeded = applyDraftToolCall(baseData(), "createBlock", {
      title: "Focus", start: "09:00", end: "11:00", category: "deep", day: 1,
    }).draft;
    const id = seeded.routine[0].id;
    const res = applyDraftToolCall(seeded, "splitBlock", { blockId: id, splitTime: "10:00" });
    expect(res.ok).toBe(true);
    expect(res.draft.routine).toHaveLength(2);
    const times = res.draft.routine.map((r) => `${r.start}-${r.end}`).sort();
    expect(times).toEqual(["09:00-10:00", "10:00-11:00"]);
  });
});

describe("draft executor — category tools", () => {
  it("createCategory then deleteCategory", () => {
    const added = applyDraftToolCall(baseData(), "createCategory", { id: "gym", label: "Gym" });
    expect(added.ok).toBe(true);
    expect(added.draft.categories.some((c) => c.id === "gym")).toBe(true);
    const removed = applyDraftToolCall(added.draft, "deleteCategory", "gym");
    expect(removed.draft.categories.some((c) => c.id === "gym")).toBe(false);
  });
});

describe("draft executor — guards", () => {
  it("unsupported tools are reported, not silently applied", () => {
    expect(isDraftSupportedTool("listBlocks")).toBe(false);
    const res = applyDraftToolCall(baseData(), "listBlocks", {});
    expect(res.ok).toBe(false);
    expect(res.error).toContain("not available");
  });
});
