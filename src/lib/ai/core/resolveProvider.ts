import type { LLMProvider } from "./provider";
import { createProviderFromSettings, resolveFallbackProvider, getProviderRegistration } from "./registry";
import { loadSettingsSync, getApiKeyForProvider } from "../settings/store";
import { isAiProxyAvailable } from "./adapters/geminiProxy";

export function resolveProvider(): LLMProvider | null {
  const settings = loadSettingsSync();
  const id = settings.providerId;
  const reg = getProviderRegistration(id);

  // Providers that don't need a key (Ollama, gemini-local) are usable when selected —
  // except gemini-local, which depends on the hosted proxy (Supabase) being configured.
  if (reg && !reg.requiresApiKey) {
    if (id === "gemini-local" && !isAiProxyAvailable()) {
      return resolveFallbackProvider(id, settings.apiKeys)?.provider ?? null;
    }
    return createProviderFromSettings({
      providerId: id,
      apiKey: "",
      model: settings.models[id],
      baseUrl: settings.baseUrls[id],
    });
  }

  const apiKey = settings.apiKeys[id] ?? getApiKeyForProvider(id);
  if (apiKey) {
    return createProviderFromSettings({
      providerId: id,
      apiKey,
      model: settings.models[id],
      baseUrl: settings.baseUrls[id],
    });
  }

  const fallback = resolveFallbackProvider(id, settings.apiKeys);
  return fallback?.provider ?? null;
}
