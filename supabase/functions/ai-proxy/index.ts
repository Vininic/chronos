// Supabase Edge Function (Deno) — secure AI proxy for the whole suite.
//
// Holds provider keys as SERVER secrets so deployed apps (Chronos, Kairos) can offer
// working AI without ever shipping a key in the client bundle. The browser calls this
// function (with the public anon key for auth); the function calls the upstream provider.
//
// Providers:
//   - "gemini" (default): Google AI Studio, hard free-tier wall (no billing = can't be charged).
//     Accepts an optional `images: [{ mimeType, dataBase64 }]` array, mapped to Gemini
//     `inlineData` parts (Pluto's statement-photo import; ≤4 images, ≤4MB each — see
//     `sanitizeImages`). Requests without `images` are unaffected.
//   - "openrouter": routes ONLY to a server-side allowlisted ":free" model — the client can
//     request a model, but this function silently substitutes a safe default if it doesn't
//     match the allowlist, so a client bug or a bad request can never spend real credit on
//     this key's finite, non-renewing balance. No image support.
//
// Deploy:  supabase functions deploy ai-proxy
// Secrets: supabase secrets set GEMINI_API_KEY=AIza...
//          supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
// Optional: supabase secrets set ALLOWED_ORIGIN="https://chronos.vercel.app,https://kairos-suite.vercel.app"
//           (comma-separated allowlist; defaults to "*" if unset)
// Rate limit table/RPC: supabase db push  (applies 0002_ai_proxy.sql)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGIN") ?? "*").split(",").map((s) => s.trim()).filter(Boolean);

// Per-IP requests allowed per minute (cost guard for the shared keys).
const RATE_LIMIT_PER_MIN = Number(Deno.env.get("AI_PROXY_RATE_LIMIT") ?? "30");

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.includes("*")
    ? "*"
    : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface ProxyImage {
  mimeType?: string;
  dataBase64?: string;
}

interface ProxyRequest {
  prompt?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  provider?: "gemini" | "openrouter";
  /** Gemini only (see `callGemini`) — e.g. Pluto's statement-photo import.
   *  Clamped to 4 images / 4MB each; oversized or malformed entries are
   *  dropped rather than failing the whole request. */
  images?: ProxyImage[];
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

/** Base64 length → decoded byte size, without actually decoding (~4/3 ratio,
 *  minus padding). Good enough for a size guard. */
function base64ByteLength(b64: string): number {
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

function sanitizeImages(images: ProxyImage[] | undefined): { mimeType: string; data: string }[] {
  if (!Array.isArray(images)) return [];
  const out: { mimeType: string; data: string }[] = [];
  for (const img of images) {
    if (out.length >= MAX_IMAGES) break;
    const mimeType = (img.mimeType ?? "").toLowerCase();
    const data = img.dataBase64 ?? "";
    if (!ALLOWED_IMAGE_MIME.has(mimeType) || !data) continue;
    if (base64ByteLength(data) > MAX_IMAGE_BYTES) continue;
    out.push({ mimeType, data });
  }
  return out;
}

const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

// Server-side allowlist for OpenRouter — the ONLY models this function will ever call on
// that key, regardless of what a client asks for. All are $0/token ":free" models. This is
// the actual safety boundary: a client can pick among these, never escape them.
// OpenRouter's free catalog rotates — verify against https://openrouter.ai/api/v1/models
// before adding an entry. Several previously-free slugs (deepseek/deepseek-chat:free,
// google/gemini-2.0-flash-exp:free) have been retired or gone paid-only. Some free models
// (openai/gpt-oss-120b:free, nousresearch/hermes-3-llama-3.1-405b:free, nvidia/nemotron-*)
// also 404 on this account until its data-sharing policy is opened up at
// https://openrouter.ai/settings/privacy — they were left out until that's configured.
const OPENROUTER_FREE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
] as const;
const DEFAULT_OPENROUTER_MODEL = OPENROUTER_FREE_MODELS[0];

function safeOpenRouterModel(requested: string | undefined): string {
  return OPENROUTER_FREE_MODELS.includes(requested as (typeof OPENROUTER_FREE_MODELS)[number])
    ? (requested as string)
    : DEFAULT_OPENROUTER_MODEL;
}

/** Best-effort per-IP limit. Fail-open: if the RPC/table is missing, allow the request. */
async function underRateLimit(ip: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return true;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data, error } = await admin.rpc("bump_ai_proxy_rate", { p_ip: ip, p_limit: RATE_LIMIT_PER_MIN });
    if (error) return true; // migration not applied yet — don't block the demo
    return data !== false;
  } catch {
    return true;
  }
}

async function callGemini(body: ProxyRequest): Promise<{ text: string; finishReason: string; usage: Record<string, number> }> {
  if (!GEMINI_API_KEY) throw new ProxyError("AI proxy not configured: GEMINI_API_KEY secret is missing.", 503);

  const maxOutputTokens = Math.min(Math.max(1, Number(body.maxTokens ?? 2048)), 2048);
  const temperature = Math.min(Math.max(0, Number(body.temperature ?? 0.5)), 2);
  const model = (body.model ?? DEFAULT_GEMINI_MODEL).toString().replace(/[^a-zA-Z0-9.\-]/g, "");

  const images = sanitizeImages(body.images);
  const parts: unknown[] = [{ text: body.prompt }];
  for (const img of images) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });

  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature, maxOutputTokens },
  };
  if (body.systemPrompt) payload.systemInstruction = { parts: [{ text: String(body.systemPrompt) }] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    .catch((err) => { throw new ProxyError(`Upstream request failed: ${err instanceof Error ? err.message : "unknown"}`, 502); });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ProxyError(`Gemini error ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }

  const data = await res.json().catch(() => null) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  } | null;

  return {
    text: data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
    finishReason: data?.candidates?.[0]?.finishReason ?? "stop",
    usage: {
      promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: data?.usageMetadata?.totalTokenCount ?? 0,
    },
  };
}

async function callOpenRouter(body: ProxyRequest): Promise<{ text: string; finishReason: string; usage: Record<string, number> }> {
  if (!OPENROUTER_API_KEY) throw new ProxyError("AI proxy not configured: OPENROUTER_API_KEY secret is missing.", 503);

  const maxTokens = Math.min(Math.max(1, Number(body.maxTokens ?? 2048)), 2048);
  const temperature = Math.min(Math.max(0, Number(body.temperature ?? 0.5)), 2);
  const model = safeOpenRouterModel(body.model); // never escapes the free-model allowlist

  const messages = [
    ...(body.systemPrompt ? [{ role: "system", content: String(body.systemPrompt) }] : []),
    { role: "user", content: body.prompt },
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      // Required by OpenRouter for free-tier attribution; harmless if ignored upstream.
      "HTTP-Referer": "https://github.com/Vininic",
      "X-Title": "Olympus Suite",
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  }).catch((err) => { throw new ProxyError(`Upstream request failed: ${err instanceof Error ? err.message : "unknown"}`, 502); });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ProxyError(`OpenRouter error ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }

  const data = await res.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  } | null;

  return {
    text: data?.choices?.[0]?.message?.content ?? "",
    finishReason: data?.choices?.[0]?.finish_reason ?? "stop",
    usage: {
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
      totalTokens: data?.usage?.total_tokens ?? 0,
    },
  };
}

class ProxyError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!(await underRateLimit(ip))) {
    return json({ error: "Rate limit exceeded. Please slow down and try again shortly." }, 429, cors);
  }

  let body: ProxyRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  if (!(body.prompt ?? "").toString().trim()) return json({ error: "Missing 'prompt'" }, 400, cors);

  try {
    const result = body.provider === "openrouter" ? await callOpenRouter(body) : await callGemini(body);
    return json(result, 200, cors);
  } catch (err) {
    if (err instanceof ProxyError) return json({ error: err.message }, err.status, cors);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500, cors);
  }
});
