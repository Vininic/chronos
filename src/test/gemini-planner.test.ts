import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMProvider } from "@/lib/ai/core/provider";
import type { PlannerPreferences } from "@/lib/ai/planner/types";

// generateGeminiProposals resolves its provider through this module — mock it so
// we can drive the no-provider, bad-output, thrown-error, and happy paths
// deterministically without any network or settings dependency.
const resolveProvider = vi.fn<() => LLMProvider | null>();
vi.mock("@/lib/ai/core/resolveProvider", () => ({
  resolveProvider: () => resolveProvider(),
}));

import { generateGeminiProposals } from "@/lib/ai/planner/gemini-planner";

const PREFS: PlannerPreferences = {
  workMode: "remote",
  workHoursStart: "09:00",
  workHoursEnd: "17:00",
  focusPreference: "deep-work",
  recoveryPriority: "medium",
  weeklyCategories: [],
  sleepStart: "23:00",
  sleepEnd: "07:00",
};

function fakeProvider(generate: () => Promise<{ text: string; finishReason: string }>): LLMProvider {
  return {
    id: "gemini",
    displayName: "Fake",
    models: ["fake"],
    defaultModel: "fake",
    supportsStreaming: false,
    supportsFunctionCalling: false,
    requiresApiKey: false,
    generateContent: generate as LLMProvider["generateContent"],
    generateContentStream: (async function* () {})() as unknown as LLMProvider["generateContentStream"],
    config: () => ({ apiKey: "" }),
  };
}

const VALID_BLUEPRINT = JSON.stringify({
  meta: { workdayStart: "09:00", workdayEnd: "17:00", sleepStart: "23:00", sleepEnd: "07:00", focusCategoryIds: ["deep-work"] },
  categories: [
    { id: "deep-work", label: "Deep Work", tone: "bronze", role: "focus" },
    { id: "recharge", label: "Recharge", tone: "emerald", role: "recovery" },
    { id: "admin", label: "Admin", tone: "neutral", role: "neutral" },
  ],
  days: [
    { day: 1, blocks: [
      { start: "09:00", end: "11:00", kind: "deep-work", title: "Morning deep work" },
      { start: "12:00", end: "13:00", kind: "recharge", title: "Lunch & walk" },
    ] },
    { day: 2, blocks: [{ start: "09:00", end: "10:30", kind: "deep-work", title: "Focus" }] },
  ],
});

describe("generateGeminiProposals", () => {
  beforeEach(() => resolveProvider.mockReset());

  it("falls back to heuristic proposals when no provider is configured", async () => {
    resolveProvider.mockReturnValue(null);
    const proposals = await generateGeminiProposals(PREFS);
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.every((p) => !p.id.startsWith("gemini-"))).toBe(true);
  });

  it("falls back when the provider returns unparseable output", async () => {
    resolveProvider.mockReturnValue(fakeProvider(async () => ({ text: "not json at all", finishReason: "stop" })));
    const proposals = await generateGeminiProposals(PREFS);
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.every((p) => !p.id.startsWith("gemini-"))).toBe(true);
  });

  it("falls back when the provider throws", async () => {
    resolveProvider.mockReturnValue(fakeProvider(async () => { throw new Error("boom"); }));
    const proposals = await generateGeminiProposals(PREFS);
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.every((p) => !p.id.startsWith("gemini-"))).toBe(true);
  });

  it("returns a single gemini proposal from a valid blueprint", async () => {
    resolveProvider.mockReturnValue(fakeProvider(async () => ({ text: VALID_BLUEPRINT, finishReason: "stop" })));
    const proposals = await generateGeminiProposals(PREFS);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].id).toMatch(/^gemini-/);
    expect(proposals[0].categoryCount).toBe(3);
    // 3 valid blocks across the blueprint's two days.
    expect(proposals[0].weeklyBlockCount).toBe(3);

    const schedule = await proposals[0].generate();
    expect(schedule.meta.focusCategoryIds).toContain("deep-work");
    // Sleep is structural, never materialized as routine blocks.
    expect(schedule.routine.every((b) => b.kind !== "sleep")).toBe(true);
    expect(schedule.meta.sleepWindow).toEqual({ start: "23:00", end: "07:00" });
  });

  it("drops malformed (non-positive duration) blocks from the blueprint", async () => {
    const bp = JSON.parse(VALID_BLUEPRINT);
    bp.days[0].blocks.push({ start: "15:00", end: "15:00", kind: "admin", title: "Zero-length" });
    bp.days[0].blocks.push({ start: "16:00", end: "15:00", kind: "admin", title: "Inverted" });
    resolveProvider.mockReturnValue(fakeProvider(async () => ({ text: JSON.stringify(bp), finishReason: "stop" })));
    const proposals = await generateGeminiProposals(PREFS);
    // Still 3 — the two malformed blocks are rejected.
    expect(proposals[0].weeklyBlockCount).toBe(3);
  });
});
