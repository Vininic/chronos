import type { LLMProvider, LLMProviderConfig, GenerateOptions, GenerateResult, ProviderId, FilePart } from "../provider";

export class OpenAIAdapter implements LLMProvider {
  readonly id: ProviderId = "openai";
  readonly displayName = "OpenAI";
  readonly models = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];
  readonly defaultModel = "gpt-4o";
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

  private buildContent(prompt: string, fileParts?: FilePart[]): string | { type: "text" | "image_url"; text?: string; image_url?: { url: string } }[] {
    if (!fileParts || fileParts.length === 0) return prompt;
    const content: { type: "text" | "image_url"; text?: string; image_url?: { url: string } }[] = [];
    for (const fp of fileParts) {
      if (fp.type === "image") {
        content.push({ type: "image_url", image_url: { url: `data:${fp.mimeType};base64,${fp.data}` } });
      } else {
        content.push({ type: "text", text: fp.data });
      }
    }
    content.push({ type: "text", text: prompt });
    return content;
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    const body: Record<string, unknown> = {
      model: this.configData.model ?? this.defaultModel,
      messages: [
        ...(options?.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
        { role: "user", content: this.buildContent(prompt, options?.fileParts) },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    };

    const res = await fetch(this.configData.baseUrl ?? "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.configData.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as {
      choices: { message: { content: string }; finish_reason: string }[];
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return {
      text: json.choices[0]?.message?.content ?? "",
      finishReason: json.choices[0]?.finish_reason ?? "stop",
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *generateContentStream(prompt: string, options?: GenerateOptions): AsyncIterable<string> {
    const body: Record<string, unknown> = {
      model: this.configData.model ?? this.defaultModel,
      messages: [
        ...(options?.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
        { role: "user", content: this.buildContent(prompt, options?.fileParts) },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stream: true,
    };

    const res = await fetch(this.configData.baseUrl ?? "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.configData.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
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
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;

        try {
          const chunk = JSON.parse(data) as {
            choices: { delta: { content?: string }; finish_reason: string | null }[];
          };
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}
