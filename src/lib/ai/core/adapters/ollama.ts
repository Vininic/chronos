import type { LLMProvider, LLMProviderConfig, GenerateOptions, GenerateResult, ProviderId } from "../provider";

export class OllamaAdapter implements LLMProvider {
  readonly id: ProviderId = "ollama";
  readonly displayName = "Ollama (Local)";
  readonly models: string[] = [];
  readonly defaultModel = "llama3";
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = false;
  readonly requiresApiKey = false;

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
      prompt,
      system: options?.systemPrompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 4096,
      },
    };

    const res = await fetch(this.configData.baseUrl ?? "http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json() as {
      response: string;
      done: boolean;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      text: json.response ?? "",
      finishReason: json.done ? "stop" : "unknown",
      usage: json.prompt_eval_count != null && json.eval_count != null
        ? {
            promptTokens: json.prompt_eval_count,
            completionTokens: json.eval_count,
            totalTokens: json.prompt_eval_count + json.eval_count,
          }
        : undefined,
    };
  }

  async *generateContentStream(prompt: string, options?: GenerateOptions): AsyncIterable<string> {
    const body: Record<string, unknown> = {
      model: this.configData.model ?? this.defaultModel,
      prompt,
      system: options?.systemPrompt,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 4096,
      },
    };

    const res = await fetch(this.configData.baseUrl ?? "http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
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
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as { response?: string; done: boolean };
          if (chunk.response) yield chunk.response;
        } catch {
          // skip
        }
      }
    }
  }
}
