// Supabase Edge Function (Deno) — interim report delivery for Pluto.
//
// The "Send report now" button on Pluto's Reports page (M5, before Hermes exists to
// own delivery — see PLUTO.md "Reports & delivery"). Sends ONLY to the caller's own
// verified account email (never a client-supplied address) — this function holds a
// Resend API key as a server secret, so it must not become an open mail relay.
//
// Auth: the client must send its own Supabase session access token as the
// Authorization header (NOT the anon key) — this function verifies it via the admin
// client and reads the user's email off the verified session, ignoring anything the
// request body claims about "to". Cloud accounts only; guest sessions have no
// Supabase user to verify.
//
// Deploy:  supabase functions deploy report-mailer
// Secrets: supabase secrets set RESEND_API_KEY=re_...
//          supabase secrets set REPORT_FROM_EMAIL="Pluto Reports <onboarding@resend.dev>"
//          (Resend's sandbox `onboarding@resend.dev` only delivers to the account
//          owner's own verified email; verify a custom domain in Resend to send to
//          arbitrary recipients — until then this only reliably reaches the developer's
//          own test account, which is fine for an interim/M5 feature.)
// Optional: supabase secrets set ALLOWED_ORIGIN="https://pluto-suite.vercel.app"
// Rate limit table/RPC: supabase db push  (applies 0003_report_mailer.sql)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const REPORT_FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") ?? "Pluto Reports <onboarding@resend.dev>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGIN") ?? "*").split(",").map((s) => s.trim()).filter(Boolean);

// Daily sends allowed per account — a report resend is an occasional action;
// this exists to stop one account from exhausting Resend's shared free quota.
const RATE_LIMIT_PER_DAY = Number(Deno.env.get("REPORT_MAILER_RATE_LIMIT") ?? "5");

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

interface MailerRequest {
  subject?: string;
  html?: string;
}

class MailerError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "Report mailer not configured: Supabase service role missing." }, 503, cors);
  if (!RESEND_API_KEY) return json({ error: "Report mailer not configured: RESEND_API_KEY secret is missing." }, 503, cors);

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in with your suite account to send a report." }, 401, cors);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user?.email) return json({ error: "Could not verify your session — sign in again." }, 401, cors);

  try {
    const underLimit = await admin.rpc("bump_report_mailer_rate", { p_user_id: user.id, p_limit: RATE_LIMIT_PER_DAY });
    if (underLimit.data === false) {
      return json({ error: "Daily report-send limit reached — try again tomorrow." }, 429, cors);
    }
    // Fail-open if the RPC/migration is missing, same as ai-proxy.
  } catch {
    /* ignore */
  }

  let body: MailerRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  const subject = (body.subject ?? "").toString().trim();
  const html = (body.html ?? "").toString();
  if (!subject || !html) return json({ error: "Missing 'subject' or 'html'" }, 400, cors);

  try {
    const result = await sendEmail(user.email, subject, html);
    return json(result, 200, cors);
  } catch (err) {
    if (err instanceof MailerError) return json({ error: err.message }, err.status, cors);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500, cors);
  }
});

async function sendEmail(to: string, subject: string, html: string): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: REPORT_FROM_EMAIL, to: [to], subject, html }),
  }).catch((err) => {
    throw new MailerError(`Upstream request failed: ${err instanceof Error ? err.message : "unknown"}`, 502);
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new MailerError(`Resend error ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { id: data.id ?? "" };
}
