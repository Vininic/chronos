import { useState, useEffect, useCallback } from "react";
import type { ProviderId } from "../core/provider";
import { getRegisteredProviders } from "../core/registry";

export const STORAGE_KEY = "chronos.ai-settings.v1";

export interface AISettings {
  providerId: ProviderId;
  apiKeys: Partial<Record<ProviderId, string>>;
  models: Partial<Record<ProviderId, string>>;
  baseUrls: Partial<Record<ProviderId, string>>;
  autonomy: "conservative" | "balanced" | "aggressive";
  featureToggles: {
    proactiveMode: boolean;
    functionCalling: boolean;
    learning: boolean;
    autoSuggestions: boolean;
    digestAuto: boolean;
  };
}

const DEFAULT_SETTINGS: AISettings = {
  providerId: "gemini-local" as ProviderId,
  apiKeys: {},
  models: {},
  baseUrls: {},
  autonomy: "balanced",
  featureToggles: {
    proactiveMode: true,
    functionCalling: true,
    learning: true,
    autoSuggestions: true,
    digestAuto: true,
  },
};

function loadSettings(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AISettings>;
      if (parsed.providerId === "gemini" && !parsed.apiKeys?.gemini) {
        parsed.providerId = "gemini-local";
      }
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...parsed.apiKeys },
        models: { ...DEFAULT_SETTINGS.models, ...parsed.models },
        baseUrls: { ...DEFAULT_SETTINGS.baseUrls, ...parsed.baseUrls },
        featureToggles: { ...DEFAULT_SETTINGS.featureToggles, ...parsed.featureToggles },
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AISettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateProvider = useCallback((providerId: ProviderId) => {
    setSettings((prev) => ({ ...prev, providerId }));
  }, []);

  const setApiKey = useCallback((providerId: ProviderId, apiKey: string) => {
    setSettings((prev) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [providerId]: apiKey },
    }));
  }, []);

  const setModel = useCallback((providerId: ProviderId, model: string) => {
    setSettings((prev) => ({
      ...prev,
      models: { ...prev.models, [providerId]: model },
    }));
  }, []);

  const setBaseUrl = useCallback((providerId: ProviderId, baseUrl: string) => {
    setSettings((prev) => ({
      ...prev,
      baseUrls: { ...prev.baseUrls, [providerId]: baseUrl },
    }));
  }, []);

  const setFeatureToggle = useCallback(<K extends keyof AISettings["featureToggles"]>(
    key: K,
    value: AISettings["featureToggles"][K],
  ) => {
    setSettings((prev) => ({
      ...prev,
      featureToggles: { ...prev.featureToggles, [key]: value },
    }));
  }, []);

  const setAutonomy = useCallback((autonomy: AISettings["autonomy"]) => {
    setSettings((prev) => ({ ...prev, autonomy }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const clearChatHistory = useCallback(() => {
    try {
      localStorage.removeItem("chronos.chat.v1");
    } catch {
      // ignore
    }
  }, []);

  const resetLearningProfile = useCallback(() => {
    try {
      localStorage.removeItem("chronos.learning.v1");
    } catch {
      // ignore
    }
  }, []);

  const getActiveApiKey = useCallback(() => {
    return settings.apiKeys[settings.providerId] ?? "";
  }, [settings]);

  const getProviderDisplayName = useCallback((id: ProviderId) => {
    const registered = getRegisteredProviders().find((p) => p.id === id);
    return registered?.name ?? id;
  }, []);

  return {
    settings,
    updateProvider,
    setApiKey,
    setModel,
    setBaseUrl,
    setFeatureToggle,
    setAutonomy,
    resetSettings,
    clearChatHistory,
    resetLearningProfile,
    getActiveApiKey,
    getProviderDisplayName,
  };
}

export function loadSettingsSync(): AISettings {
  return loadSettings();
}

export function getApiKeyForProvider(providerId: ProviderId): string {
  if (providerId === "gemini-local" && typeof import.meta !== "undefined") {
    return import.meta.env.VITE_GEMINI_API_KEY ?? "";
  }
  const settings = loadSettings();
  return settings.apiKeys[providerId] ?? "";
}

export function isProviderConfigured(providerId: ProviderId): boolean {
  const registered = getRegisteredProviders().find((p) => p.id === providerId);
  if (!registered?.requiresApiKey) return true;
  return !!getApiKeyForProvider(providerId);
}
