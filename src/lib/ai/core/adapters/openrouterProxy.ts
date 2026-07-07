import type { LLMProvider, LLMProviderConfig, GenerateOptions, GenerateResult, ProviderId } from "../provider";
import { loadSupabaseConfig } from "@/lib/supabase/client";

/**
 * The hosted "OpenRouter (Hosted)" provider routes through the same `ai-proxy` Supabase
 * Edge Function as gemini-local, with `provider: "openrouter"`. The function holds the
 * OpenRouter key as a SERVER secret and enforces a server-side allowlist of `:free` models
 * — a client can never spend real credit on that key, regardless of what model it asks for.
 */
export function isAiProxyAvailable(): boolean {
  return loadSupabaseConfig() !== null;
}

function proxyEndpoint(): { url: string; anonKey: string } {
  const cfg = loadSupabaseConfig();
  if (!cfg) throw new Error("AI proxy unavailable: no Supabase project configured.");
  return { url: `${cfg.url.replace(/\/$/, "")}/functions/v1/ai-proxy`, anonKey: cfg.anonKey };
}

async function callProxy(prompt: string, options: GenerateOptions | undefined, model: string): Promise<GenerateResult> {
  const { url, anonKey } = proxyEndpoint();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        provider: "openrouter",
        prompt,
        systemPrompt: options?.systemPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        model,
      }),
    });
  } catch {
    throw new Error("The hosted AI isn't available right now (ai-proxy unreachable). Add your own API key in AI Settings.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error ?? "";
    } catch {
      /* ignore */
    }
    if (res.status === 404 || res.status === 503) {
      throw new Error("The hosted AI isn't available yet. Add your own API key in AI Settings, or deploy the ai-proxy function.");
    }
    throw new Error(detail || `AI proxy error ${res.status}`);
  }

  const data = (await res.json()) as { text?: string; finishReason?: string; usage?: GenerateResult["usage"] };
  return {
    text: data.text ?? "",
    finishReason: data.finishReason ?? "stop",
    usage: data.usage,
  };
}

export class OpenRouterProxyAdapter implements LLMProvider {
  readonly id: ProviderId = "openrouter-local";
  readonly displayName = "OpenRouter (Hosted)";
  // Server-enforced allowlist — keep in sync with supabase/functions/ai-proxy/index.ts.
  readonly models = ["meta-llama/llama-3.3-70b-instruct:free", "qwen/qwen3-next-80b-a3b-instruct:free"];
  readonly defaultModel = "meta-llama/llama-3.3-70b-instruct:free";
  readonly supportsStreaming = true;
  readonly supportsFunctionCalling = true;
  readonly requiresApiKey = false;

  private configData: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.configData = { ...config, model: config.model ?? this.defaultModel };
  }

  config(): LLMProviderConfig {
    return { ...this.configData };
  }

  async generateContent(prompt: string, options?: GenerateOptions): Promise<GenerateResult> {
    return callProxy(prompt, options, this.configData.model ?? this.defaultModel);
  }

  // The proxy returns a full completion (no SSE in v1); yield it as a single chunk so the
  // streaming chat UI works unchanged.
  async *generateContentStream(prompt: string, options?: GenerateOptions): AsyncIterable<string> {
    const result = await this.generateContent(prompt, options);
    yield result.text;
  }
}
