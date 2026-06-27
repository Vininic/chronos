import type { LLMProvider, LLMProviderConfig, GenerateOptions, GenerateResult, ProviderId } from "../provider";
import { loadSupabaseConfig } from "@/lib/supabase/client";

/**
 * The hosted "Gemini (Local)" provider routes through the `ai-proxy` Supabase Edge
 * Function, which holds the Google API key as a SERVER secret. The key is never in the
 * client bundle. Availability therefore depends on a Supabase project being configured
 * (env at build time, or a BYO project in Settings).
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
        // Edge Functions require an apikey/JWT; the public anon key is the expected caller credential.
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        prompt,
        systemPrompt: options?.systemPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        model,
      }),
    });
  } catch {
    // Network/CORS failure (e.g. the ai-proxy function isn't deployed). Tag it so the
    // chat layer shows the actionable "add your own API key" message.
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

export class GeminiProxyAdapter implements LLMProvider {
  readonly id: ProviderId = "gemini-local";
  readonly displayName = "Gemini (Hosted)";
  readonly models = ["gemini-3.1-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"];
  readonly defaultModel = "gemini-3.1-flash-lite";
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
