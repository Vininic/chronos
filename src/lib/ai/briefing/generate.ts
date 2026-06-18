import type { ScheduleData } from "@/lib/schedule/types";
import { buildContext } from "../context/buildContext";
import { compressContext } from "../context/serializers";
import { createProviderFromSettings, resolveFallbackProvider } from "../core/registry";
import { loadSettingsSync } from "../settings/store";

const SYSTEM_PROMPT = "You are Aetheris, a friendly personal schedule assistant. Give brief, helpful daily briefings.";

const BRIEFING_PROMPT = `Today is {date}.

Below is the user's weekly schedule. Write a 2-3 sentence daily briefing covering:
- How many blocks (routines + commitments) they have today
- Any notable patterns or issues (back-to-back blocks, empty gaps, heavy load)
- A small actionable suggestion for today

Schedule:
{context}

Briefing:`;

import { setLatestBriefing } from "@/lib/notification-count";

function fallbackBriefing(): string {
  return `Good day! I have your schedule ready — check your agenda in the timeline above.`;
}

export async function generateDailyBriefing(data: ScheduleData): Promise<string> {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  try {
    const settings = loadSettingsSync();
    const providerId = settings.providerId;
    const apiKey = settings.apiKeys[providerId] ?? "";

    const ctx = buildContext(data, "balanced");
    const compressed = compressContext(ctx);
    const serialized = JSON.stringify(compressed, null, 2);

    const prompt = BRIEFING_PROMPT
      .replace("{date}", dateStr)
      .replace("{context}", serialized);

    let provider;
    if (apiKey) {
      provider = createProviderFromSettings({
        providerId,
        apiKey,
        model: settings.models[providerId],
        baseUrl: settings.baseUrls[providerId],
      });
    } else {
      const fallback = resolveFallbackProvider(providerId, settings.apiKeys);
      if (!fallback) return fallbackBriefing();
      provider = fallback.provider;
    }

    const result = await provider.generateContent(prompt, {
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 300,
    });

    const text = result.text.trim() || fallbackBriefing();
    setLatestBriefing(text);
    return text;
  } catch {
    const fb = fallbackBriefing();
    setLatestBriefing(fb);
    return fb;
  }
}
