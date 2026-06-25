import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenAIAdapter } from "@/lib/ai/core/adapters/openai";

function mockFetchOnce(impl: () => Partial<Response> & { json?: () => Promise<unknown> }) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => impl() as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("OpenAIAdapter.generateContent", () => {
  it("sends a system + user message and parses the completion", async () => {
    const fetchFn = mockFetchOnce(() => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello there" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    }));

    const adapter = new OpenAIAdapter({ apiKey: "sk-test", model: "gpt-4o" });
    const result = await adapter.generateContent("What's up?", { systemPrompt: "You are Aetheris", temperature: 0.3, maxTokens: 256 });

    expect(result.text).toBe("Hello there");
    expect(result.finishReason).toBe("stop");
    expect(result.usage?.totalTokens).toBe(15);

    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("gpt-4o");
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(256);
    expect(body.messages).toEqual([
      { role: "system", content: "You are Aetheris" },
      { role: "user", content: "What's up?" },
    ]);
  });

  it("omits the system message when no systemPrompt is given", async () => {
    const fetchFn = mockFetchOnce(() => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "x" }, finish_reason: "stop" }] }),
    }));
    await new OpenAIAdapter({ apiKey: "k" }).generateContent("hi");
    const body = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("throws a descriptive error on a non-OK response", async () => {
    mockFetchOnce(() => ({ ok: false, status: 401, statusText: "Unauthorized" }));
    await expect(new OpenAIAdapter({ apiKey: "bad" }).generateContent("hi")).rejects.toThrow(/401/);
  });
});
