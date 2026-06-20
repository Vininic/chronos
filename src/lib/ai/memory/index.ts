const PREFERENCE_TAG = /\[PREFERENCE:\s*(\w[\w.-]*)\s*=\s*([^\]]+)\]/g;

export function extractPreferences(text: string): Record<string, string> {
  const prefs: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = PREFERENCE_TAG.exec(text)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && value) {
      prefs[key] = value;
    }
  }
  return prefs;
}

export function stripPreferenceTags(text: string): string {
  return text.replace(/\s*\[PREFERENCE:\s*\w[\w.-]*\s*=\s*[^\]]+\]/g, "").trim();
}

export function formatPreferencesForPrompt(prefs: Record<string, string>): string {
  if (!prefs || typeof prefs !== "object") return "";
  const entries = Object.entries(prefs);
  if (entries.length === 0) return "";
  const lines = entries.map(([key, value]) => `- ${key}: ${value}`);
  return `## Known User Preferences\n\nBased on past conversations, the user has shared:\n${lines.join("\n")}\n`;
}
