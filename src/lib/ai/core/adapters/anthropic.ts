import type { LLMProvider, LLMProviderConfig, GenerateOptions, GenerateResult, ProviderId } from "../provider";

export class AnthropicAdapter implements LLMProvider {
  readonly id: ProviderId = "anthropic";
  readonly displayName = "Anthropic";
  readonly models = ["claude-sonnet-4-20250514", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"];
  readonly defaultModel = "claude-sonnet-4-20250514";
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;
  readonly requiresApiKey = true;

  private configData: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.configData = { ...config, model: config.model ?? this.defaultModel };
  }

  config(): LLMProviderConfig {
    return { ...this.configData };
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    const body: Record<string, unknown> = {
      model: this.configData.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 4096,
      messages: [{ role: "user", content: prompt }],
      ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      temperature: options?.temperature ?? 0.7,
    };

    const res = await fetch(this.configData.baseUrl ?? "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.configData.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as {
      content: { text: string }[];
      stop_reason: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    return {
      text: json.content?.map((c) => c.text).join("") ?? "",
      finishReason: json.stop_reason ?? "stop",
      usage: json.usage
        ? {
            promptTokens: json.usage.input_tokens,
            completionTokens: json.usage.output_tokens,
            totalTokens: json.usage.input_tokens + json.usage.output_tokens,
          }
        : undefined,
    };
  }

  async *generateContentStream(prompt: string, options?: GenerateOptions): AsyncIterable<string> {
    const body: Record<string, unknown> = {
      model: this.configData.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? 4096,
      messages: [{ role: "user", content: prompt }],
      ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      temperature: options?.temperature ?? 0.7,
      stream: true,
    };

    const res = await fetch(this.configData.baseUrl ?? "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.configData.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const chunk = JSON.parse(data) as {
            type: string;
            delta?: { text?: string };
            content_block?: { text?: string };
          };
          if (chunk.type === "content_block_delta" && chunk.delta?.text) {
            yield chunk.delta.text;
          }
          if (chunk.type === "content_block_start" && chunk.content_block?.text) {
            yield chunk.content_block.text;
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}
