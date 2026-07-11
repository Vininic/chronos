import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { processChatMessage, streamChatMessage } from "@/lib/ai/chat/service";
import { STORAGE_KEY as AI_SETTINGS_KEY } from "@/lib/ai/settings/store";
import type { ScheduleData } from "@/lib/schedule/types";

/**
 * Regression test for the Aetheris locale instruction (ported from the fix
 * Kairos/Pluto shipped on 2026-07-11 — Chronos was left for its own pass
 * because its prompt is assembled from versioned blocks + an appended string,
 * not a single template function). Confirms the system prompt actually sent
 * to the provider tells the model what language the user's UI is in.
 */

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
  categories: [],
  routine: [],
  commitments: [],
  presets: [],
  suggestions: [],
  goals: [],
  ledger: { compositionScore: 0.75, metrics: [], scheduledHours: [0, 0, 0, 0, 0, 0, 0] },
  progressSnapshots: [],
};

function stubOpenAISettings() {
  localStorage.setItem(
    AI_SETTINGS_KEY,
    JSON.stringify({
      providerId: "openai",
      apiKeys: { openai: "sk-test" },
      models: { openai: "gpt-4o" },
      baseUrls: {},
      autonomy: "balanced",
      featureToggles: { proactiveMode: false, functionCalling: true, learning: false, autoSuggestions: false, digestAuto: false },
    }),
  );
}

function mockFetchCapture() {
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}");
    // Streaming path just needs a well-formed (empty) SSE body; non-streaming
    // path needs a normal chat-completion JSON body.
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: new TextEncoder().encode("data: [DONE]\n\n") };
            },
          };
        },
      },
      _requestBody: body,
    } as unknown as Response & { _requestBody: unknown };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Aetheris locale instruction", () => {
  it("processChatMessage appends the UI language to the system prompt (English)", async () => {
    stubOpenAISettings();
    const fetchFn = mockFetchCapture();

    await processChatMessage(MINIMAL_SCHEDULE, [], "hi", "en");

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toContain("The user's UI language is English");
  });

  it("processChatMessage appends the UI language to the system prompt (Português)", async () => {
    stubOpenAISettings();
    const fetchFn = mockFetchCapture();

    await processChatMessage(MINIMAL_SCHEDULE, [], "oi", "pt");

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMessage.content).toContain("The user's UI language is Português (Brasil)");
  });

  it("processChatMessage defaults to pt-BR when locale is omitted", async () => {
    stubOpenAISettings();
    const fetchFn = mockFetchCapture();

    await processChatMessage(MINIMAL_SCHEDULE, [], "hi");

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMessage.content).toContain("The user's UI language is Português (Brasil)");
  });

  it("streamChatMessage (the actual Aetheris.tsx call path) appends the locale instruction too", async () => {
    stubOpenAISettings();
    const fetchFn = mockFetchCapture();

    const stream = streamChatMessage(MINIMAL_SCHEDULE, [], "hi", "balanced", undefined, "en");
    for await (const _chunk of stream) { /* drain */ }

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    const systemMessage = body.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMessage.content).toContain("The user's UI language is English");
    // Autonomy instruction should still be present alongside it (append order matters).
    expect(systemMessage.content).toContain("BALANCED mode");
  });
});
