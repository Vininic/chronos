import { describe, it, expect } from "vitest";
import { buildContext, summarizeBlocks } from "@/lib/ai/context";
import { validateContext } from "@/lib/ai/context/validation";
import { compressContext, compressedTokenEstimate } from "@/lib/ai/context/serializers";
import { buildChatPrompt } from "@/lib/ai/chat/service";
import type { ScheduleData } from "@/lib/schedule/types";

const MINIMAL_SCHEDULE: ScheduleData = {
  meta: {
    version: 3,
    owner: "Test User",
    cycle: { name: "Cycle 1", number: 1, week: 1, progress: 0.5 },
    workdayStart: "09:00",
    workdayEnd: "18:00",
    focusCategoryIds: ["deep"],
    sleepSchedule: [{ start: "23:00", end: "07:00" }],
  },
  categories: [
    { id: "deep", label: "Deep Work", description: "Focused work blocks", tone: "custom", color: "#f59e0b" },
    { id: "recovery", label: "Recovery", description: "Rest and recovery", tone: "custom", color: "#10b981" },
  ],
  routine: [
    {
      id: "r1",
      day: new Date().getDay(),
      kind: "deep",
      title: "Focus Session",
      start: "10:00",
      end: "12:00",
    },
    {
      id: "r2",
      day: new Date().getDay(),
      kind: "recovery",
      title: "Lunch Break",
      start: "12:00",
      end: "13:00",
      notes: "Feeling tired after morning focus",
    },
  ],
  commitments: [
    {
      id: "c1",
      date: new Date().toISOString().slice(0, 10),
      start: "14:00",
      end: "15:00",
      kind: "meeting",
      title: "Team Standup",
    },
  ],
  presets: [],
  suggestions: [],
  goals: [
    {
      id: "g1",
      kind: "deadline",
      tracking: "subTask",
      title: "Complete Portfolio",
      description: "Finish portfolio website",
      target: 5,
      period: "total",
      deadline: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d.toISOString().slice(0, 10);
      })(),
      weight: 2,
      startDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      blocks: [],
      subTasks: [
        { id: "st1", title: "Design homepage", done: true },
        { id: "st2", title: "Build components", done: false },
        { id: "st3", title: "Deploy", done: false },
      ],
      looseCommitmentIds: [],
    },
    {
      id: "g2",
      kind: "duration",
      tracking: "goalBlock",
      title: "Exercise 5h/week",
      target: 300,
      unit: "min",
      period: "weekly",
      weight: 1,
      startDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      blocks: [],
      subTasks: [],
      looseCommitmentIds: [],
    },
  ],
  ledger: {
    compositionScore: 0.75,
    metrics: [
      { label: "Focus", value: 120 },
      { label: "Recovery", value: 60 },
    ],
    scheduledHours: [8, 8, 8, 8, 8, 4, 4],
  },
  progressSnapshots: [],
};

describe("ScheduleContext — buildContext", () => {
  it("should build a valid context from schedule data", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    expect(ctx.version).toBe(1);
    expect(ctx.owner).toBe("Test User");
    expect(ctx.blocks.length).toBeGreaterThan(0);
    expect(ctx.categories.length).toBe(2);
    expect(ctx.sleep.metrics.averageDurationMin).toBeGreaterThan(0);
  });

  it("should set default autonomy to balanced", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    expect(ctx.autonomy).toBe("balanced");
  });

  it("should respect provided autonomy level", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE, "conservative");
    expect(ctx.autonomy).toBe("conservative");
  });

  it("should include blocks sorted by start time", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    for (let i = 1; i < ctx.blocks.length; i++) {
      const prev = ctx.blocks[i - 1].start;
      const curr = ctx.blocks[i].start;
      expect(prev <= curr).toBe(true);
    }
  });

  it("should map block progress from workspace runtime", () => {
    const data = {
      ...MINIMAL_SCHEDULE,
      routine: MINIMAL_SCHEDULE.routine.map((r) =>
        r.id === "r1" ? { ...r, workspace: { templateName: "Focus", tracking: { "item-1": true } } } : r,
      ),
      categories: MINIMAL_SCHEDULE.categories.map((c) =>
        c.id === "deep"
          ? {
              ...c,
              workspace: {
                levels: [
                  { key: "item", label: "Item", labelPlural: "Items", fields: [], tracking: { type: "boolean" as const, default: false, label: "Done" } },
                ],
                display: { summary: "{done}/{total}", progress: "boolean" as const },
                templates: [{ name: "Focus", children: [{ name: "Task 1", fields: {} }] }],
              },
            }
          : c,
      ),
    } as unknown as ScheduleData;

    const ctx = buildContext(data);
    const focusBlock = ctx.blocks.find((b) => b.id === "r1");
    expect(focusBlock).toBeDefined();
    expect(focusBlock!.hasProgram).toBe(true);
  });

  it("should extract notes from blocks and commitments", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    const notes = ctx.notes;
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.some((n) => n.text.includes("tired"))).toBe(true);
  });
});

describe("ScheduleContext — summarizeBlocks", () => {
  it("should return correct block summary", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    const summary = summarizeBlocks(ctx.blocks);
    expect(summary.total).toBe(ctx.blocks.length);
    expect(summary.routine + summary.commitment).toBe(summary.total);
  });
});

describe("ScheduleContext — validation", () => {
  it("should return valid for a well-formed context", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    const result = validateContext(ctx);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should detect missing owner", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    const broken = { ...ctx, owner: "" };
    const result = validateContext(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("owner"))).toBe(true);
  });

  it("should warn on large block counts", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    const broken = { ...ctx, blocks: Array(250).fill(ctx.blocks[0]) };
    const result = validateContext(broken);
    expect(result.warnings.some((w) => w.includes("Large block"))).toBe(true);
  });
});

describe("ScheduleContext — compression", () => {
  it("should compress without throwing", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    const compressed = compressContext(ctx);
    expect(compressed.owner).toBe("Test User");
    expect(compressed.blocks.length).toBeGreaterThan(0);
    expect(compressed.goals.length).toBeGreaterThan(0);
  });

  it("should estimate token count", () => {
    const ctx = buildContext(MINIMAL_SCHEDULE);
    const compressed = compressContext(ctx);
    const estimate = compressedTokenEstimate(compressed);
    expect(estimate).toBeGreaterThan(0);
  });
});

describe("buildChatPrompt — system prompt is not duplicated into the body", () => {
  // Regression guard: the system prompt (persona + tool schema + autonomy) is sent
  // once via the provider's `systemPrompt` option. It must NOT also be baked into the
  // prompt body, which previously doubled the token cost of every chat request.
  it("leads the body with schedule data, not the persona", () => {
    const body = buildChatPrompt(MINIMAL_SCHEDULE, []);
    expect(body.startsWith("## Current Schedule Data")).toBe(true);
    expect(body).not.toContain("schedule assistant");
  });

  it("still serializes the schedule context into the body", () => {
    const body = buildChatPrompt(MINIMAL_SCHEDULE, []);
    expect(body).toContain("Test User");
  });
});
