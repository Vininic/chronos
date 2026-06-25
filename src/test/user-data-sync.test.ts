import { describe, it, expect } from "vitest";
import { sanitizeForPush, mergeOnPull, SYNCED_DOMAINS } from "@/lib/sync/userDataSync";

describe("userDataSync — API key carve-out", () => {
  it("strips apiKeys from settings before upload", () => {
    const settings = { providerId: "openai", apiKeys: { openai: "sk-secret", gemini: "g-secret" }, autonomy: "balanced" };
    const out = sanitizeForPush("settings", settings) as typeof settings;
    expect(out.apiKeys).toEqual({});
    expect(out.providerId).toBe("openai"); // non-secret prefs preserved
    expect(out.autonomy).toBe("balanced");
  });

  it("leaves non-settings domains untouched on push", () => {
    const learning = { completions: [1, 2, 3] };
    expect(sanitizeForPush("learning", learning)).toBe(learning);
  });

  it("keeps the device's local apiKeys when pulling settings", () => {
    const remote = { providerId: "anthropic", apiKeys: {}, autonomy: "aggressive" };
    const localRaw = JSON.stringify({ providerId: "openai", apiKeys: { openai: "sk-local" } });
    const merged = mergeOnPull("settings", remote, localRaw) as { providerId: string; apiKeys: Record<string, string> };
    expect(merged.providerId).toBe("anthropic"); // remote prefs win
    expect(merged.apiKeys).toEqual({ openai: "sk-local" }); // local secrets kept
  });

  it("defaults to empty apiKeys when there is no local settings", () => {
    const merged = mergeOnPull("settings", { providerId: "gemini", apiKeys: {} }, null) as { apiKeys: Record<string, string> };
    expect(merged.apiKeys).toEqual({});
  });

  it("returns remote unchanged for non-settings domains on pull", () => {
    const remote = { threads: ["a"] };
    expect(mergeOnPull("chat", remote, null)).toBe(remote);
  });

  it("never syncs API keys or device-only data (registry sanity)", () => {
    const keys = SYNCED_DOMAINS.map((d) => d.storageKey);
    // settings IS synced (but key-stripped); device-only stores must NOT be in the registry.
    expect(keys).toContain("chronos.ai-settings.v1");
    expect(keys).not.toContain("chronos.keyboard.v1");
    expect(keys).not.toContain("chronos.session.v1");
    expect(keys).not.toContain("chronos.push.subscription");
  });
});
