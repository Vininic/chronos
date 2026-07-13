-- Hermes outbox consumer — production delivery engine.
--
-- Rate limiting table (per-user, per-day) so one account can't exhaust
-- shared Resend/Telegram/WhatsApp quotas in a single cron cycle.
-- The Edge Function uses the service role (bypasses RLS), so this table
-- has RLS enabled with NO policies: unreachable by anon/authenticated clients.

create table if not exists public.outbox_consumer_rate_limit (
  user_id     uuid   not null,
  day         date   not null,
  count       int    not null default 0,
  primary key (user_id, day)
);

alter table public.outbox_consumer_rate_limit enable row level security;

create or replace function public.bump_outbox_consumer_rate(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := current_date;
  c int;
begin
  insert into public.outbox_consumer_rate_limit (user_id, day, count)
    values (p_user_id, d, 1)
  on conflict (user_id, day)
    do update set count = public.outbox_consumer_rate_limit.count + 1
  returning count into c;

  delete from public.outbox_consumer_rate_limit where day < current_date - interval '7 days';

  return c <= p_limit;
end;
$$;

-- ── pg_cron schedule ──────────────────────────────────────────────────
-- Polls the outbox every minute via a Net HTTP POST to the Edge Function.
-- Requires pg_cron extension (enabled via supabase, typically pre-installed).
--
-- The function is invoked with a no-op POST (no auth needed because the
-- service role is used internally). If pg_cron is not available, the
-- function can be triggered manually or via an external scheduler.

-- Wrap in a DO block so it's idempotent (cron.schedule is already safe).
do $$
begin
  -- Only create the schedule if pg_cron is available
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('outbox-consumer-poll', '* * * * *',
      'select net.http_post(
        url:=''' || current_setting('app.settings.edge_function_url', true) || '/outbox-consumer'',
        headers:=''{"Content-Type": "application/json"}"::jsonb,
        body:=''{}''::jsonb
      );'
    );
  end if;
end;
$$;
