// Supabase Edge Function (Deno) — secure Gemini proxy.
//
// Holds the Google AI Studio key as a SERVER secret so the deployed demo can offer
// working AI without ever shipping the key in the client bundle. The browser calls
// this function (with the public anon key for auth); the function calls Google.
//
// Deploy:  supabase functions deploy ai-proxy
// Secret:  supabase secrets set GEMINI_API_KEY=AIza...
// Optional: supabase secrets set ALLOWED_ORIGIN=https://your-app.vercel.app
//           (restricts browser callers; defaults to "*")
// Rate limit table/RPC: supabase db push  (applies 0002_ai_proxy.sql)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

// Per-IP requests allowed per minute (cost guard for the shared key).
const RATE_LIMIT_PER_MIN = Number(Deno.env.get("AI_PROXY_RATE_LIMIT") ?? "30");

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface ProxyRequest {
  prompt?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!GEMINI_API_KEY) {
    return json({ error: "AI proxy not configured: GEMINI_API_KEY secret is missing." }, 503);
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  if (!(await underRateLimit(ip))) {
    return json({ error: "Rate limit exceeded. Please slow down and try again shortly." }, 429);
  }

  let body: ProxyRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const prompt = (body.prompt ?? "").toString();
  if (!prompt.trim()) return json({ error: "Missing 'prompt'" }, 400);

  // Clamp to keep each call cheap regardless of what the client asks for.
  const maxOutputTokens = Math.min(Math.max(1, Number(body.maxTokens ?? 2048)), 2048);
  const temperature = Math.min(Math.max(0, Number(body.temperature ?? 0.5)), 2);
  const model = (body.model ?? DEFAULT_MODEL).toString().replace(/[^a-zA-Z0-9.\-]/g, "");

  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  };
  if (body.systemPrompt) {
    payload.systemInstruction = { parts: [{ text: String(body.systemPrompt) }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json({ error: `Upstream request failed: ${err instanceof Error ? err.message : "unknown"}` }, 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Surface quota/rate problems with their status so the client can show a friendly note.
    return json({ error: `Gemini error ${res.status}: ${detail.slice(0, 300)}` }, res.status);
  }

  const data = await res.json().catch(() => null) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  } | null;

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const finishReason = data?.candidates?.[0]?.finishReason ?? "stop";
  const usage = {
    promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
    totalTokens: data?.usageMetadata?.totalTokenCount ?? 0,
  };

  return json({ text, finishReason, usage });
});
