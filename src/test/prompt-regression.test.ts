import { describe, it, expect } from "vitest";
import { PromptBuilder } from "@/lib/ai/prompts/builder";
import { getBlock, getVersionInfo, versionedBlocks } from "@/lib/ai/prompts/v1";
import { formatPreferencesForPrompt, extractPreferences, stripPreferenceTags } from "@/lib/ai/memory";
import { selectPromptVersion } from "@/lib/ai/chat/service";
import { evaluateResponse } from "@/lib/ai/eval/selfEval";

/* ─── Prompt Builder ─── */

describe("PromptBuilder", () => {
  it("builds system prompt with all required blocks", () => {
    const prompt = PromptBuilder.chatSystemPrompt("1.0");
    expect(prompt).toContain("Aetheris");
    expect(prompt).toContain("schedule assistant");
    expect(prompt).toContain("{tools}");
    expect(prompt).toContain("Rules");
  });

  it("builds lite version with simplified content", () => {
    const lite = PromptBuilder.chatSystemPrompt("1.0-lite");
    expect(lite).toContain("Aetheris");
    expect(lite).toContain("friendly");
    expect(lite).not.toContain("Always explain your reasoning");
  });

  it("builds A/B variant B with analytical tone", () => {
    const b = PromptBuilder.chatSystemPrompt("1.0-b");
    expect(b).toContain("data-driven");
    expect(b).toContain("analyst");
    expect(b).toContain("actionable insights");
  });

  it("falls back to latest version when unknown version requested", () => {
    const prompt = PromptBuilder.chatSystemPrompt("9.9.9");
    expect(prompt).toContain("Aetheris");
    expect(prompt).toContain("{tools}");
  });
});

/* ─── Versioned Blocks ─── */

describe("Versioned blocks", () => {
  it("v1 contains all required block names", () => {
    const names = versionedBlocks.map((b) => b.name);
    expect(names).toContain("persona");
    expect(names).toContain("tools");
    expect(names).toContain("rules");
    expect(names).toContain("context");
    expect(names).toContain("conversation");
  });

  it("has at least 3 rule entries (1.0, 1.0-lite, 1.0-b)", () => {
    const rules = versionedBlocks.filter((b) => b.name === "rules");
    expect(rules.length).toBeGreaterThanOrEqual(3);
  });

  it("getBlock returns the correct version", () => {
    const persona = getBlock("persona", "1.0");
    expect(persona).toBeDefined();
    expect(persona!.text).toContain("Chronos");
  });

  it("getVersionInfo returns metadata", () => {
    const info = getVersionInfo();
    expect(info.version).toBe("1.0");
    expect(info.blocks.length).toBeGreaterThan(0);
  });
});

/* ─── Version Selection ─── */

describe("selectPromptVersion", () => {
  function makeMsg(role: "user" | "assistant", n: number) {
    return Array.from({ length: n }, (_, i) => ({
      id: `m-${i}`,
      role,
      content: "hello",
      timestamp: new Date().toISOString(),
    }));
  }

  it("returns lite for 0 user messages", () => {
    expect(selectPromptVersion(makeMsg("assistant", 2))).toBe("1.0-lite");
  });

  it("returns lite for 1-3 user messages", () => {
    expect(selectPromptVersion(makeMsg("user", 1))).toBe("1.0-lite");
    expect(selectPromptVersion(makeMsg("user", 2))).toBe("1.0-lite");
    expect(selectPromptVersion(makeMsg("user", 3))).toBe("1.0-lite");
  });

  it("returns A/B variant for 4+ user messages", () => {
    const version = selectPromptVersion(makeMsg("user", 4));
    expect(version === "1.0" || version === "1.0-b").toBe(true);
  });
});

/* ─── Preference Memory ─── */

describe("Preference memory", () => {
  it("extractPreferences finds [PREFERENCE: key=value] tags", () => {
    const text = "I suggest adjusting your schedule. [PREFERENCE: deep-work-time=morning] [PREFERENCE: focus-duration=90]";
    const prefs = extractPreferences(text);
    expect(prefs["deep-work-time"]).toBe("morning");
    expect(prefs["focus-duration"]).toBe("90");
  });

  it("extractPreferences returns empty object when no tags present", () => {
    expect(extractPreferences("Just a normal response.")).toEqual({});
  });

  it("stripPreferenceTags removes preference tags", () => {
    const text = "Here is my suggestion. [PREFERENCE: deep-work-time=morning] Let me know.";
    expect(stripPreferenceTags(text)).toBe("Here is my suggestion. Let me know.");
  });

  it("formatPreferencesForPrompt formats correctly", () => {
    const result = formatPreferencesForPrompt({ "deep-work-time": "morning" });
    expect(result).toContain("Known User Preferences");
    expect(result).toContain("deep-work-time: morning");
  });

  it("formatPreferencesForPrompt returns empty string for empty prefs", () => {
    expect(formatPreferencesForPrompt({})).toBe("");
  });
});

/* ─── Self-Evaluation ─── */

describe("Self-evaluation", () => {
  it("scores high for a good response", () => {
    const score = evaluateResponse(
      "Analyze my schedule",
      "I recommend you move your deep work block to the morning because your focus is highest then. Consider adding a recovery block on Wednesday afternoon. [PREFERENCE: deep-work-time=morning]",
      [],
    );
    expect(score.overall).toBeGreaterThanOrEqual(70);
    expect(score.helpfulness).toBeGreaterThanOrEqual(60);
    expect(score.accuracy).toBeGreaterThanOrEqual(80);
  });

  it("scores low for empty response", () => {
    const score = evaluateResponse("Analyze my schedule", "", []);
    expect(score.overall).toBeLessThan(50);
  });

  it("scores low for hallucination-like response", () => {
    const score = evaluateResponse(
      "What blocks do I have?",
      "I think there might be a block at 3pm but perhaps there is another at 4pm. Maybe there's a deep work block somewhere.",
      [],
    );
    expect(score.overall).toBeLessThan(60);
  });
});
