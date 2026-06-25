// Supabase Edge Function (Deno) — sends Web Push reminders for upcoming blocks.
//
// Deploy:  supabase functions deploy notify
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@x.com
// Schedule (run every ~5 min) via Supabase cron (Dashboard → Database → Cron), e.g.:
//   select cron.schedule('chronos-notify','*/5 * * * *',
//     $$ select net.http_post('https://<ref>.functions.supabase.co/notify',
//          '{}', 'application/json', '{"Authorization":"Bearer <anon>"}') $$);
//
// ⚠️ Timezone: schedule block times are the user's LOCAL time, but this function runs
// in UTC. For correct per-block reminders, store the user's IANA tz (e.g. add `tz` to
// the synced `settings` row) and convert below. Until then this only fires a simple
// same-UTC-hour reminder — treat the agenda math as a TODO, not production-complete.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@chronos.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

interface RoutineBlock { day: number; start: string; end: string; title: string; kind: string }

/** Blocks starting in the next `windowMin` minutes. TODO: honor each user's tz + commitments + sleep cuts. */
function dueReminders(schedule: { routine?: RoutineBlock[] }, now: Date, windowMin: number): RoutineBlock[] {
  const day = now.getUTCDay();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (schedule.routine ?? []).filter((b) => {
    if (b.day !== day) return false;
    const [h, m] = b.start.split(":").map(Number);
    const startMin = h * 60 + m;
    return startMin >= nowMin && startMin < nowMin + windowMin;
  });
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const now = new Date();

  // Join each device subscription with its owner's schedule.
  const { data: subs } = await supabase.from("push_subscriptions").select("user_id, subscription");
  if (!subs?.length) return new Response("no subscriptions", { status: 200 });

  let sent = 0;
  for (const sub of subs as { user_id: string; subscription: unknown }[]) {
    const { data: row } = await supabase
      .from("user_data").select("value").eq("user_id", sub.user_id).eq("key", "schedule").maybeSingle();
    if (!row?.value) continue;

    for (const block of dueReminders(row.value as { routine?: RoutineBlock[] }, now, 5)) {
      try {
        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          JSON.stringify({ title: "Starting soon", body: `${block.start} — ${block.title}`, data: { url: "/dashboard" } }),
        );
        sent++;
      } catch (_e) {
        // 404/410 ⇒ stale subscription; a production version should prune it here.
      }
    }
  }
  return new Response(`sent ${sent}`, { status: 200 });
});
