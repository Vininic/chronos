-- Fixes 0004's cron schedule, which never actually ran: the DO block's
-- `if exists (select 1 from pg_extension where extname = 'pg_cron')` guard
-- was silently false (pg_cron wasn't enabled yet), and even once enabled,
-- `current_setting('app.settings.edge_function_url', true)` was never set
-- by anything — Supabase's managed Postgres doesn't allow ALTER DATABASE
-- SET for custom parameters at all (confirmed: permission denied even via
-- migration push, not just the ad-hoc query path).
--
-- Real fix: the service_role key (needed so the cron-triggered call, which
-- has no user session, still passes this function's JWT check) lives in
-- Supabase Vault instead — inserted separately via
-- `select vault.create_secret(key, 'hermes_service_role_key', ...)`,
-- never committed to any file. This migration only references it by name.
--
-- pg_cron and pg_net must both be enabled for this to run (pg_cron to fire
-- on schedule, pg_net for the outbound net.http_post call) — enabled
-- separately with explicit user confirmation, not by this migration.

select cron.unschedule('outbox-consumer-poll')
where exists (select 1 from cron.job where jobname = 'outbox-consumer-poll');

select cron.schedule(
  'outbox-consumer-poll',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://ebaxejpvcvbifaviptas.supabase.co/functions/v1/outbox-consumer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'hermes_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
