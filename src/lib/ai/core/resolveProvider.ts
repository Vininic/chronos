import type { LLMProvider } from "./provider";
import { createProviderFromSettings, resolveFallbackProvider } from "./registry";
import { loadSettingsSync, getApiKeyForProvider } from "../settings/store";

export function resolveProvider(): LLMProvider | null {
  const settings = loadSettingsSync();
  const apiKey = settings.apiKeys[settings.providerId] ?? getApiKeyForProvider(settings.providerId);
  if (apiKey) {
    return createProviderFromSettings({
      providerId: settings.providerId,
      apiKey,
      model: settings.models[settings.providerId],
      baseUrl: settings.baseUrls[settings.providerId],
    });
  }
  const fallback = resolveFallbackProvider(settings.providerId, settings.apiKeys);
  return fallback?.provider ?? null;
}
