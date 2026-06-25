import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { ToolRegistry, globalToolRegistry } from "@/lib/ai/tools/registry";
import { registerBlockTools } from "@/lib/ai/tools/blockTools";
import { registerGoalTools } from "@/lib/ai/tools/goalTools";
import { extractToolCalls, stripToolCallsFromText, validateTimeReferences } from "@/lib/ai/chat/service";
import type { ScheduleData } from "@/lib/schedule/types";
import { makeCtx, block } from "./aiFixtures";

/* ── ToolRegistry executor (isolated) ──────────────────────── */

describe("ToolRegistry", () => {
  it("returns an error for an unknown tool", () => {
    const reg = new ToolRegistry();
    const res = reg.execute("ghost", {});
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unknown tool");
  });

  it("short-circuits on a validation error before executing", () => {
    const reg = new ToolRegistry();
    const execute = vi.fn(() => 1);
    reg.register({ name: "t", description: "", category: "block", permission: "write", validate: () => "nope", execute });
    const res = reg.execute("t", {});
    expect(res.success).toBe(false);
    expect(res.error).toBe("nope");
    expect(execute).not.toHaveBeenCalled();
  });

  it("catches exceptions thrown by execute", () => {
    const reg = new ToolRegistry();
    reg.register({ name: "boom", description: "", category: "block", permission: "write", execute: () => { throw new Error("kaboom"); } });
    const res = reg.execute("boom", {});
    expect(res.success).toBe(false);
    expect(res.error).toBe("kaboom");
  });

  it("returns data on success", () => {
    const reg = new ToolRegistry();
    reg.register({ name: "ok", description: "", category: "read", permission: "read", execute: () => ({ value: 42 }) });
    const res = reg.execute<unknown, { value: number }>("ok", {});
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ value: 42 });
  });

  it("ignores duplicate registrations (first wins)", () => {
    const reg = new ToolRegistry();
    reg.register({ name: "dup", description: "", category: "read", permission: "read", execute: () => "first" });
    reg.register({ name: "dup", description: "", category: "read", permission: "read", execute: () => "second" });
    expect(reg.getAll()).toHaveLength(1);
    expect(reg.execute("dup", {}).data).toBe("first");
  });

  it("filters by category", () => {
    const reg = new ToolRegistry();
    reg.register({ name: "a", description: "", category: "block", permission: "write", execute: () => null });
    reg.register({ name: "b", description: "", category: "goal", permission: "write", execute: () => null });
    expect(reg.getByCategory("block").map((t) => t.name)).toEqual(["a"]);
    expect(reg.get("missing")).toBeUndefined();
  });
});

/* ── Tool-call parsing (pure) ──────────────────────────────── */

describe("extractToolCalls / stripToolCallsFromText", () => {
  it("parses a single tool call with JSON params", () => {
    const calls = extractToolCalls('[TOOL:createBlock]{"title":"Focus","start":"10:00"}[/TOOL]');
    expect(calls).toEqual([{ tool: "createBlock", params: { title: "Focus", start: "10:00" } }]);
  });

  it("parses multiple tool calls", () => {
    const calls = extractToolCalls('[TOOL:a]{"x":1}[/TOOL] text [TOOL:b]{"y":2}[/TOOL]');
    expect(calls.map((c) => c.tool)).toEqual(["a", "b"]);
  });

  it("falls back to raw params on malformed JSON", () => {
    const calls = extractToolCalls("[TOOL:weird]not json[/TOOL]");
    expect(calls[0].tool).toBe("weird");
    expect(calls[0].params).toEqual({ raw: "not json" });
  });

  it("returns [] when there are no tool tags", () => {
    expect(extractToolCalls("just a normal answer")).toEqual([]);
  });

  it("strips tool tags from display text", () => {
    const text = 'Done! [TOOL:createBlock]{"title":"X"}[/TOOL]';
    expect(stripToolCallsFromText(text)).toBe("Done!");
  });
});

describe("validateTimeReferences", () => {
  const data = {
    routine: [{ start: "14:30", end: "15:30" }],
    commitments: [],
  } as unknown as ScheduleData;

  it("warns about a time that matches no block", () => {
    const warnings = validateTimeReferences("Let's meet at 09:45 today", data);
    expect(warnings.some((w) => w.includes("09:45"))).toBe(true);
  });

  it("does not warn about a known block time", () => {
    expect(validateTimeReferences("Your block at 14:30 looks good", data)).toHaveLength(0);
  });

  it("ignores midnight and on-the-hour morning references", () => {
    expect(validateTimeReferences("00:00 and 24:00 and 08:00 and 12:00", data)).toHaveLength(0);
  });
});

/* ── Block + goal tool modules (validate + execute + mutators) ─ */

const addRoutine = vi.fn((_b: Record<string, unknown>) => "new-block-id");
const updateRoutine = vi.fn((_id: string, _patch: Record<string, unknown>) => null);
const removeRoutine = vi.fn();
const addGoal = vi.fn((_g: Record<string, unknown>) => "new-goal-id");
const updateGoal = vi.fn();
const removeGoal = vi.fn();

beforeAll(() => {
  const ctx = makeCtx({ blocks: [block({ id: "r1", start: "10:00", end: "11:00", category: "deep", title: "Focus" })] });
  registerBlockTools(ctx, { addRoutine, updateRoutine, removeRoutine } as never);
  registerGoalTools({ addGoal, updateGoal, removeGoal } as never);
});

beforeEach(() => {
  addRoutine.mockClear();
  updateRoutine.mockClear();
  removeRoutine.mockClear();
  addGoal.mockClear();
  updateGoal.mockClear();
  removeGoal.mockClear();
});

describe("blockTools (via registry)", () => {
  it("rejects createBlock without a title (validation)", () => {
    const res = globalToolRegistry.execute("createBlock", { start: "12:00", end: "13:00", category: "deep", day: 1 });
    expect(res.success).toBe(false);
    expect(res.error).toBe("title is required");
    expect(addRoutine).not.toHaveBeenCalled();
  });

  it("blocks createBlock that overlaps an existing block (safety)", () => {
    const res = globalToolRegistry.execute("createBlock", { title: "X", start: "10:30", end: "11:30", category: "deep", day: 1 });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Focus");
    expect(addRoutine).not.toHaveBeenCalled();
  });

  it("creates a non-overlapping block and maps params to the mutator", () => {
    const res = globalToolRegistry.execute("createBlock", { title: "New", start: "12:00", end: "13:00", category: "deep", day: 2 });
    expect(res.success).toBe(true);
    expect(res.data).toBe("new-block-id");
    expect(addRoutine).toHaveBeenCalledWith({ day: 2, start: "12:00", end: "13:00", kind: "deep", title: "New", notes: undefined });
  });

  it("deletes an unprotected block", () => {
    const res = globalToolRegistry.execute("deleteBlock", "r1");
    expect(res.success).toBe(true);
    expect(removeRoutine).toHaveBeenCalledWith("r1");
  });

  it("fails splitBlock when the block does not exist", () => {
    const res = globalToolRegistry.execute("splitBlock", { blockId: "nope", splitTime: "10:30" });
    expect(res.success).toBe(false);
    expect(res.error).toContain("not found");
  });
});

describe("goalTools (via registry)", () => {
  it("rejects createGoal with a non-positive target", () => {
    const res = globalToolRegistry.execute("createGoal", { title: "G", kind: "duration", tracking: "minutes", period: "weekly", target: 0 });
    expect(res.success).toBe(false);
    expect(res.error).toBe("target must be positive");
  });

  it("creates a goal and forwards it to the mutator", () => {
    const res = globalToolRegistry.execute("createGoal", { title: "Read more", kind: "numeric", tracking: "count", period: "weekly", target: 5 });
    expect(res.success).toBe(true);
    expect(res.data).toBe("new-goal-id");
    expect(addGoal).toHaveBeenCalledOnce();
    expect(addGoal.mock.calls[0][0]).toMatchObject({ title: "Read more", target: 5, weight: 1 });
  });

  it("archives a goal by id", () => {
    const res = globalToolRegistry.execute("archiveGoal", "g1");
    expect(res.success).toBe(true);
    expect(removeGoal).toHaveBeenCalledWith("g1");
  });
});
