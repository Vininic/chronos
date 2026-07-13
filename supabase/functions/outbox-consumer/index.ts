// Supabase Edge Function (Deno) — Hermes outbox consumer (production engine).
//
// Polls `hermes-outbox` user_data rows for pending messages across all suite apps,
// routes by channel, delivers via the appropriate API, and writes back sent|failed status.
//
// This is the production delivery engine, generalized from Pluto's interim `report-mailer`.
// n8n (local Docker) is the design/demo layer only — production never depends on n8n.
//
// Channels:
//   - "email":   Resend API (same key as report-mailer)
//   - "telegram": Telegram Bot API
//   - "whatsapp": Meta WhatsApp Cloud API (test mode)
//
// Deploy:    supabase functions deploy outbox-consumer
// Schedule:  select cron.schedule('outbox-poll', '* * * * *', 'select net.http_post(url:=..., ...)')
// Secrets:   supabase secrets set RESEND_API_KEY=re_...
//            supabase secrets set REPORT_FROM_EMAIL="Hermes <onboarding@resend.dev>"
//            supabase secrets set TELEGRAM_BOT_TOKEN=...
//            supabase secrets set WHATSAPP_ACCESS_TOKEN=...
//            supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...
// Optional:  supabase secrets set ALLOWED_ORIGIN="..."
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const REPORT_FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") ?? "Hermes <onboarding@resend.dev>";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGIN") ?? "*").split(",").map((s) => s.trim()).filter(Boolean);

const RATE_LIMIT_PER_RUN = Number(Deno.env.get("OUTBOX_RATE_LIMIT") ?? "20");

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

// ── Types ──────────────────────────────────────────────────────────────

type MessageChannel = "email" | "telegram" | "whatsapp";
type MessageStatus = "pending" | "sent" | "failed";
type MessageSource = "pluto" | "chronos" | "kairos" | "chiron" | "hermes";
type MessageTemplate = "monthly-report" | "budget-alert" | "digest" | "deadline-reminder" | "custom";

interface OutboxMessage {
  id: string;
  source: MessageSource;
  channel: MessageChannel;
  template: MessageTemplate;
  subject: string;
  payload: Record<string, unknown>;
  status: MessageStatus;
  createdAt: string;
  sentAt?: string;
  error?: string;
  attempts: number;
}

interface OutboxDocument {
  version: number;
  messages: OutboxMessage[];
}

// ── CORS + utilities ───────────────────────────────────────────────────

function notConfigured(channel: string): Response {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
  return json({ error: `${channel} channel not configured: missing secret.` }, 503, cors);
}

class DeliveryError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// ── Outbox read/write ─────────────────────────────────────────────────

async function fetchPendingMessages(admin: ReturnType<typeof createClient>): Promise<{ userId: string; messages: OutboxMessage[] }[]> {
  const { data, error } = await admin
    .from("user_data")
    .select("user_id, value")
    .eq("key", "hermes-outbox");

  if (error) throw new DeliveryError(`Failed to fetch outbox rows: ${error.message}`, 500);
  if (!data || data.length === 0) return [];

  const pending: { userId: string; messages: OutboxMessage[] }[] = [];
  for (const row of data) {
    const doc = row.value as OutboxDocument;
    if (!doc?.messages) continue;
    const msgs = doc.messages.filter((m) => m.status === "pending" && m.attempts < 5);
    if (msgs.length > 0) pending.push({ userId: row.user_id as string, messages: msgs });
  }
  return pending;
}

async function markMessage(admin: ReturnType<typeof createClient>, userId: string, messageId: string, status: MessageStatus, error?: string): Promise<void> {
  const { data: row, error: fetchError } = await admin
    .from("user_data")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "hermes-outbox")
    .single();

  if (fetchError || !row) return;

  const doc = row.value as OutboxDocument;
  const idx = doc.messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return;

  doc.messages[idx].status = status;
  doc.messages[idx].attempts += 1;
  if (status === "sent") doc.messages[idx].sentAt = new Date().toISOString();
  if (error) doc.messages[idx].error = error;

  await admin.from("user_data").update({ value: doc, version: Date.now() }).eq("user_id", userId).eq("key", "hermes-outbox");
}

// ── Channel delivery ──────────────────────────────────────────────────

async function deliverEmail(msg: OutboxMessage, userEmail: string): Promise<void> {
  if (!RESEND_API_KEY) throw new DeliveryError("RESEND_API_KEY not configured", 503);

  const subject = msg.subject || "(no subject)";
  const html = (msg.payload.html as string) || (msg.payload.text as string) || "";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: REPORT_FROM_EMAIL, to: [userEmail], subject, html }),
  }).catch((err) => { throw new DeliveryError(`Resend request failed: ${err.message}`, 502); });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DeliveryError(`Resend error ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
}

async function deliverTelegram(msg: OutboxMessage, _userEmail: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) throw new DeliveryError("TELEGRAM_BOT_TOKEN not configured", 503);

  const chatId = msg.payload.telegramChatId as string;
  if (!chatId) throw new DeliveryError("Telegram chat_id not provided in payload", 400);

  const text = `*${msg.subject}*\n\n${(msg.payload.text as string) || ""}`;

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  }).catch((err) => { throw new DeliveryError(`Telegram request failed: ${err.message}`, 502); });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DeliveryError(`Telegram error ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
}

async function deliverWhatsApp(msg: OutboxMessage, _userEmail: string): Promise<void> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) throw new DeliveryError("WhatsApp not configured", 503);

  const to = msg.payload.whatsappPhone as string;
  if (!to) throw new DeliveryError("WhatsApp recipient phone not provided in payload", 400);

  const text = `${msg.subject}\n\n${(msg.payload.text as string) || ""}`;

  const res = await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  }).catch((err) => { throw new DeliveryError(`WhatsApp request failed: ${err.message}`, 502); });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DeliveryError(`WhatsApp error ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
}

async function getUserEmail(admin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

// ── Main handler ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: "Outbox consumer not configured: Supabase service role missing." }, 503, cors);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const results: { messageId: string; status: MessageStatus; error?: string }[] = [];

  try {
    const pending = await fetchPendingMessages(admin);
    let delivered = 0;

    for (const { userId, messages } of pending) {
      if (delivered >= RATE_LIMIT_PER_RUN) break;

      const userEmail = await getUserEmail(admin, userId);

      for (const msg of messages) {
        if (delivered >= RATE_LIMIT_PER_RUN) break;
        delivered++;

        try {
          switch (msg.channel) {
            case "email":
              if (!userEmail) throw new DeliveryError("No email on user account", 400);
              await deliverEmail(msg, userEmail);
              break;
            case "telegram":
              await deliverTelegram(msg, userEmail ?? "");
              break;
            case "whatsapp":
              await deliverWhatsApp(msg, userEmail ?? "");
              break;
            default:
              throw new DeliveryError(`Unknown channel: ${msg.channel}`, 400);
          }
          await markMessage(admin, userId, msg.id, "sent");
          results.push({ messageId: msg.id, status: "sent" });
        } catch (err) {
          const errMsg = err instanceof DeliveryError ? err.message : err instanceof Error ? err.message : "Unknown error";
          await markMessage(admin, userId, msg.id, "failed", errMsg);
          results.push({ messageId: msg.id, status: "failed", error: errMsg });
        }
      }
    }

    return json({ ok: true, processed: results.length, results }, 200, cors);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500, cors);
  }
});
