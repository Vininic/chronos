import type { LLMProvider, LLMProviderConfig, ProviderId } from "./provider";
import { GeminiAdapter } from "./adapters/gemini";
import { OpenAIAdapter } from "./adapters/openai";
import { AnthropicAdapter } from "./adapters/anthropic";
import { OllamaAdapter } from "./adapters/ollama";
import { OpenRouterAdapter } from "./adapters/openrouter";

export interface ProviderRegistration {
  id: ProviderId;
  name: string;
  adapter: new (config: LLMProviderConfig) => LLMProvider;
  defaultModel: string;
  requiresApiKey: boolean;
  capabilities: {
    streaming: boolean;
    functionCalling: boolean;
  };
}

const PROVIDER_REGISTRY = new Map<ProviderId, ProviderRegistration>([
  ["gemini-local", {
    id: "gemini-local",
    name: "Gemini (Local)",
    adapter: GeminiAdapter,
    defaultModel: "gemini-3.1-flash-lite",
    requiresApiKey: false,
    capabilities: { streaming: true, functionCalling: true },
  }],
  ["gemini", {
    id: "gemini",
    name: "Gemini",
    adapter: GeminiAdapter,
    defaultModel: "gemini-3.1-flash-lite",
    requiresApiKey: true,
    capabilities: { streaming: true, functionCalling: true },
  }],
  ["openai", {
    id: "openai",
    name: "OpenAI",
    adapter: OpenAIAdapter,
    defaultModel: "gpt-4o",
    requiresApiKey: true,
    capabilities: { streaming: true, functionCalling: true },
  }],
  ["anthropic", {
    id: "anthropic",
    name: "Anthropic",
    adapter: AnthropicAdapter,
    defaultModel: "claude-sonnet-4-20250514",
    requiresApiKey: true,
    capabilities: { streaming: true, functionCalling: true },
  }],
  ["ollama", {
    id: "ollama",
    name: "Ollama (Local)",
    adapter: OllamaAdapter,
    defaultModel: "llama3",
    requiresApiKey: false,
    capabilities: { streaming: true, functionCalling: false },
  }],
  ["openrouter", {
    id: "openrouter",
    name: "OpenRouter",
    adapter: OpenRouterAdapter,
    defaultModel: "openai/gpt-4o-mini",
    requiresApiKey: true,
    capabilities: { streaming: true, functionCalling: true },
  }],
]);

export function getRegisteredProviders(): ProviderRegistration[] {
  return Array.from(PROVIDER_REGISTRY.values());
}

export function getProviderRegistration(id: ProviderId): ProviderRegistration | undefined {
  return PROVIDER_REGISTRY.get(id);
}

export function createProvider(id: ProviderId, config: LLMProviderConfig): LLMProvider {
  const registration = PROVIDER_REGISTRY.get(id);
  if (!registration) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return new registration.adapter(config);
}

export function createProviderFromSettings(settings: {
  providerId: ProviderId;
  apiKey: string;
  model?: string;
  baseUrl?: string;
}): LLMProvider {
  const config: LLMProviderConfig = {
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
  };
  return createProvider(settings.providerId, config);
}

const FALLBACK_PROVIDER_CHAIN: ProviderId[] = ["gemini-local", "gemini", "openrouter", "openai", "anthropic", "ollama"];

export function resolveFallbackProvider(
  preferredId: ProviderId,
  apiKeys: Partial<Record<ProviderId, string>>,
): { provider: LLMProvider; id: ProviderId } | null {
  const chain = [preferredId, ...FALLBACK_PROVIDER_CHAIN.filter((id) => id !== preferredId)];

  for (const id of chain) {
    const registration = PROVIDER_REGISTRY.get(id);
    if (!registration) continue;

    if (registration.requiresApiKey && !apiKeys[id]) continue;

    const provider = createProvider(id, {
      apiKey: apiKeys[id] ?? "",
      model: registration.defaultModel,
    });

    return { provider, id };
  }

  return null;
}

export async function testProviderConnection(provider: LLMProvider): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await provider.generateContent("Reply with exactly one word: ok", {
      maxTokens: 10,
      temperature: 0,
    });
    return { ok: result.text.toLowerCase().includes("ok") };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
