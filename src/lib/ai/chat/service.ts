import type { ScheduleData } from "@/lib/schedule/types";
import { buildContext } from "../context/buildContext";
import { compressContext } from "../context/serializers";
import type { ChatMessage, FileAttachment } from "./store";
import type { FilePart } from "../core/provider";
import { createProviderFromSettings, resolveFallbackProvider, getProviderRegistration } from "../core/registry";
import { loadSettingsSync, getApiKeyForProvider } from "../settings/store";
import { globalToolRegistry, type ToolDefinition } from "../tools/registry";
import { PromptBuilder } from "../prompts/builder";
import { recordLLMCall } from "../core/logger";
import { evaluateResponse } from "../eval/selfEval";
import { loadProfile } from "../learning/store";
import { formatPreferencesForPrompt } from "../memory";

const AB_VARIANT_KEY = "chronos.ab-variant";

const REASON_LABELS: Record<string, string> = {
  irrelevant: "Not relevant",
  incorrect: "Incorrect info",
  "too-vague": "Too vague",
  "already-known": "Already known",
  other: "Custom feedback",
  "thumbs-down": "Thumbs down",
  deferred: "Deferred",
};

export function getABVariant(): string {
  try {
    let variant = localStorage.getItem(AB_VARIANT_KEY);
    if (!variant) {
      variant = Math.random() < 0.5 ? "1.0" : "1.0-b";
      localStorage.setItem(AB_VARIANT_KEY, variant);
    }
    return variant;
  } catch {
    return "1.0";
  }
}

export function selectPromptVersion(messages: ChatMessage[]): string {
  const userMsgCount = messages.filter((m) => m.role === "user").length;
  if (userMsgCount <= 3) return "1.0-lite";
  return getABVariant();
}

function buildToolSchema(): string {
  const tools = globalToolRegistry.getAll();
  return tools.map((t) => {
    const params = describeToolParams(t);
    return `- **${t.name}**: ${t.description} (${t.permission})${params ? `\n  Params: ${params}` : ""}`;
  }).join("\n");
}

function describeToolParams(tool: ToolDefinition): string {
  const keyMap: Record<string, string> = {
    blockId: "string (block ID)",
    title: "string",
    start: 'string (HH:mm)',
    end: 'string (HH:mm)',
    category: "string (category ID)",
    day: "number (0=Sun, 1=Mon, ..., 6=Sat)",
    notes: "string (optional)",
    newStart: 'string (HH:mm)',
    newEnd: 'string (HH:mm)',
    splitTime: 'string (HH:mm)',
    blockIds: "string[] (block IDs)",
    mergedTitle: "string (optional)",
    commitmentId: "string",
    goalId: "string",
    categoryId: "string",
    text: "string",
    date: 'string (YYYY-MM-DD)',
  };

  const name = tool.name;
  const known = [
    "createBlock", "updateBlock", "moveBlock", "deleteBlock",
    "splitBlock", "mergeBlocks",
    "addCommitment", "updateCommitment", "removeCommitment",
    "addNote", "updateNote", "removeNote",
    "suggestBlock", "suggestCommitment",
    "setFocusCategories",
    "getBlocks", "getCommitments", "getGoals", "getCategories",
  ];

  if (known.includes(name)) {
    const params = [];
    if (["createBlock", "updateBlock", "splitBlock", "mergeBlocks", "deleteBlock", "moveBlock"].includes(name)) {
      if (name === "createBlock") params.push("title, start, end, category, day");
      if (name === "updateBlock") params.push("blockId, patch (title/start/end/category/notes)");
      if (name === "moveBlock") params.push("blockId, newStart, newEnd");
      if (name === "deleteBlock") params.push("blockId");
      if (name === "splitBlock") params.push("blockId, splitTime");
      if (name === "mergeBlocks") params.push("blockIds[], mergedTitle?");
    }
    if (["addCommitment", "updateCommitment", "removeCommitment"].includes(name)) {
      if (name === "addCommitment") params.push("title, start, end, day?, date?, category");
      if (name === "updateCommitment") params.push("commitmentId, patch");
      if (name === "removeCommitment") params.push("commitmentId");
    }
    return params.length > 0 ? params.join(", ") : "";
  }

  return "";
}

function formatMessageAttachments(msg: ChatMessage): string {
  if (!msg.attachments?.length) return "";
  return msg.attachments.map((a) => {
    const kindLabels: Record<string, string> = { image: "Image", spreadsheet: "Spreadsheet", json: "JSON", calendar: "Calendar", text: "Text", other: "File" };
    const kind = kindLabels[a.kind] ?? "File";
    if (a.kind === "image") {
      return `[Attached ${kind}: ${a.name} (${a.mimeType}) — included as image for visual analysis]`;
    }
    if (a.kind === "spreadsheet") {
      return `[Attached ${kind}: ${a.name}]\nExtracted content:\n${a.data.slice(0, 8000)}`;
    }
    if (a.kind === "json") {
      return `[Attached ${kind}: ${a.name}]\nContent:\n${a.data.slice(0, 5000)}`;
    }
    return `[Attached ${kind}: ${a.name} — ${a.size} bytes]`;
  }).join("\n\n");
}

function formatMessageForPrompt(msg: ChatMessage): string {
  const role = msg.role === "assistant" ? "Aetheris" : "User";
  let text = `${role}: ${msg.content}`;
  const att = formatMessageAttachments(msg);
  if (att) text += "\n" + att;
  if (msg.toolCalls?.length) {
    const calls = msg.toolCalls.map((tc) => {
      const status = tc.undone ? " [UNDONE]" : "";
      if (tc.error) return `  → Tool "${tc.tool}" failed: ${tc.error}${status}`;
      if (tc.result) return `  → Tool "${tc.tool}" executed: ${JSON.stringify(tc.result)}${status}`;
      return `  → Tool "${tc.tool}" called with ${JSON.stringify(tc.params)}${status}`;
    });
    text += "\n" + calls.join("\n");
  }
  return text;
}

export function buildFileParts(attachments: FileAttachment[]): FilePart[] {
  const parts: FilePart[] = [];
  for (const a of attachments) {
    if (a.kind === "image") {
      parts.push({ type: "image", data: a.data, mimeType: a.mimeType });
    }
  }
  return parts;
}

export function buildChatPrompt(
  data: ScheduleData,
  messages: ChatMessage[],
  version?: string,
): string {
  if (!data || !messages) return "Chat unavailable.";
  const ctx = buildContext(data, "balanced");
  const compressed = compressContext(ctx);
  const serialized = JSON.stringify(compressed, null, 2);

  // The system prompt (tool schema + autonomy) is delivered once via the provider's
  // `systemPrompt` option in processChatMessage / streamChatMessage — do NOT duplicate
  // it into the prompt body (that doubled every request's token cost).
  const sections = ["## Current Schedule Data", "", serialized];

  const profile = loadProfile();
  const prefsText = formatPreferencesForPrompt(profile.userPreferences);
  if (prefsText) {
    sections.push("", prefsText);
  }

  const rejected = profile.rejectedSuggestions;
  if (rejected && rejected.length > 0) {
    const recent = rejected.slice(-5);
    const lines = recent.map((r) => {
      const reasonLabel = REASON_LABELS[r.reason] ?? r.reason;
      const notes = r.userNotes ? ` — "${r.userNotes}"` : "";
      return `- [${reasonLabel}] ${r.title}: ${r.detail.slice(0, 100)}${notes}`;
    });
    sections.push("", "## Recently Rejected Suggestions", "", "The user previously rejected these suggestions with specific reasons. Avoid repeating similar ones unless the user explicitly asks:", "", ...lines);
  }

  sections.push("", "## Conversation", "");
  const recentMessages = messages.slice(-20);
  for (const msg of recentMessages) {
    sections.push(formatMessageForPrompt(msg));
  }
  sections.push("", "Aetheris:", "");
  return sections.join("\n");
}

export interface ChatResult {
  text: string;
  toolCalls: Array<{
    tool: string;
    params: Record<string, unknown>;
    result?: Record<string, unknown>;
    error?: string;
  }>;
}

export async function processChatMessage(
  data: ScheduleData,
  messages: ChatMessage[],
  userMessage: string,
): Promise<ChatResult> {
  const fullMessages: ChatMessage[] = [
    ...messages,
    { id: "pending-user", role: "user", content: userMessage, timestamp: new Date().toISOString() },
  ];

  const version = selectPromptVersion(messages);
  const prompt = buildChatPrompt(data, fullMessages, version);

  const settings = loadSettingsSync();
  const providerId = settings.providerId;
  const modelName = settings.models[providerId];
  const reg = getProviderRegistration(providerId);
  const apiKey = settings.apiKeys[providerId] || getApiKeyForProvider(providerId);

  let provider;

  if (reg && !reg.requiresApiKey || apiKey) {
    provider = createProviderFromSettings({
      providerId,
      apiKey: apiKey || "",
      model: modelName,
      baseUrl: settings.baseUrls[providerId],
    });
  } else {
    const fallback = resolveFallbackProvider(providerId, settings.apiKeys);
    if (!fallback) {
      return {
        text: "No AI provider configured. Go to AI Settings to add an API key.",
        toolCalls: [],
      };
    }
    provider = fallback.provider;
  }

  const systemPrompt = PromptBuilder.chatSystemPrompt(version).replace("{tools}", buildToolSchema());
  const startTime = performance.now();
  const result = await provider.generateContent(prompt, {
    systemPrompt,
    temperature: 0.5,
    maxTokens: 4096,
  });
  const latencyMs = Math.round(performance.now() - startTime);

  recordLLMCall(
    settings.providerId,
    modelName ?? "unknown",
    version,
    prompt.slice(0, 1000),
    result.text.slice(0, 1000),
    latencyMs,
    evaluateResponse(prompt, result.text, []),
  );

  const text = result.text;
  const toolCalls = extractToolCalls(text);

  const executedCalls = [];
  for (const call of toolCalls) {
    try {
      const execResult = globalToolRegistry.execute(call.tool, call.params);
      executedCalls.push({
        tool: call.tool,
        params: call.params,
        result: execResult.success ? execResult.data : undefined,
        error: execResult.success ? undefined : execResult.error,
      });
    } catch (err) {
      executedCalls.push({
        tool: call.tool,
        params: call.params,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return {
    text: stripToolCallsFromText(text),
    toolCalls: executedCalls,
  };
}

const AUTONOMY_INSTRUCTIONS: Record<string, string> = {
  conservative: "\n\n## Autonomy: Mild\nYou are in MILD mode. Always describe planned changes in an 'Actions:' section and wait for the user's explicit confirmation before calling any write tools (createBlock, deleteBlock, updateBlock, moveBlock, etc.). Never act on your own.",
  balanced: "\n\n## Autonomy: Balanced\nYou are in BALANCED mode. For low-risk additions or time adjustments, proceed with write tools directly. For deletions or major restructuring, describe the changes in an 'Actions:' section and ask for confirmation first.",
  aggressive: "\n\n## Autonomy: Aggressive\nYou are in AGGRESSIVE mode. Execute all schedule changes immediately using the available write tools — do not ask for confirmation. After executing, briefly confirm what was done.",
};

export async function* streamChatMessage(
  data: ScheduleData,
  messages: ChatMessage[],
  userMessage: string,
  autonomy?: "conservative" | "balanced" | "aggressive",
  attachments?: FileAttachment[],
): AsyncIterable<string> {
  const fullMessages: ChatMessage[] = [
    ...messages,
    { id: "pending-user", role: "user", content: userMessage, timestamp: new Date().toISOString(), attachments },
  ];
  const version = selectPromptVersion(messages);
  const prompt = buildChatPrompt(data, fullMessages, version);

  const settings = loadSettingsSync();
  const resolvedAutonomy = autonomy ?? settings.autonomy ?? "balanced";
  const providerId = settings.providerId;
  const modelName = settings.models[providerId];
  const reg = getProviderRegistration(providerId);
  const apiKey = settings.apiKeys[providerId] || getApiKeyForProvider(providerId);
  const fileParts = attachments ? buildFileParts(attachments) : undefined;
  let provider;

  if (reg && !reg.requiresApiKey || apiKey) {
    provider = createProviderFromSettings({
      providerId,
      apiKey: apiKey || "",
      model: modelName,
      baseUrl: settings.baseUrls[providerId],
    });
  } else {
    const fallback = resolveFallbackProvider(providerId, settings.apiKeys);
    if (!fallback) {
      yield "No AI provider configured. Go to AI Settings to add an API key.";
      return;
    }
    provider = fallback.provider;
  }

  const systemPrompt =
    PromptBuilder.chatSystemPrompt(version).replace("{tools}", buildToolSchema()) +
    (AUTONOMY_INSTRUCTIONS[resolvedAutonomy] ?? "");
  try {
    const stream = provider.generateContentStream(prompt, {
      systemPrompt,
      temperature: 0.5,
      maxTokens: 4096,
      fileParts,
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.includes("quota") || msg.includes("Quota exceeded") || msg.includes("rate_limit") || msg.includes("RESOURCE_EXHAUSTED")) {
      yield "I'm sorry, but the AI service is currently unavailable because the API quota has been exceeded. Please wait a while and try again, or configure a different AI provider in Settings.";
    } else if (msg.includes("hosted AI isn't available") || msg.includes("ai-proxy") || msg.includes("Supabase")) {
      // Hosted Gemini proxy not deployed/reachable — guide the user to BYO key.
      yield "The hosted AI isn't available right now. Add your own API key in AI Settings to chat with Aetheris.";
    } else {
      yield "I'm sorry, I encountered an error while processing your request. Please try again.";
    }
  }
}

export function extractToolCalls(text: string): Array<{ tool: string; params: Record<string, unknown> }> {
  const calls: Array<{ tool: string; params: Record<string, unknown> }> = [];
  const toolPattern = /\[TOOL:(\w+)\]([\s\S]*?)\[\/TOOL\]/g;
  let match;

  while ((match = toolPattern.exec(text)) !== null) {
    try {
      const params = JSON.parse(match[2].trim());
      calls.push({ tool: match[1], params });
    } catch {
      calls.push({ tool: match[1], params: { raw: match[2].trim() } });
    }
  }

  return calls;
}

export function stripToolCallsFromText(text: string): string {
  return text.replace(/\[TOOL:\w+\][\s\S]*?\[\/TOOL\]/g, "").trim();
}

export function validateTimeReferences(text: string, data: ScheduleData): string[] {
  const warnings: string[] = [];
  const timePattern = /\b(\d{1,2}):(\d{2})\b/g;
  const foundTimes = new Set<string>();
  let match;
  while ((match = timePattern.exec(text)) !== null) {
    const h = parseInt(match[1], 10);
    if (h >= 0 && h <= 24) foundTimes.add(match[0]);
  }

  const knownTimes = new Set<string>();
  for (const b of data.routine) {
    knownTimes.add(b.start);
    knownTimes.add(b.end);
  }
  for (const c of data.commitments) {
    knownTimes.add(c.start);
    knownTimes.add(c.end);
  }

  for (const t of foundTimes) {
    if (t === "00:00" || t === "24:00") continue;
    if (t.endsWith(":00") && parseInt(t, 10) >= 0 && parseInt(t, 10) <= 12) continue;
    const exists = [...knownTimes].some((kt) => kt.startsWith(t.slice(0, 5)));
    if (!exists) {
      warnings.push(`Time reference "${t}" does not match any block in the schedule.`);
    }
  }

  return warnings;
}
