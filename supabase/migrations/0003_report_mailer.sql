-- report-mailer rate limiting
-- Backs the `report-mailer` Edge Function (Pluto's interim "Send report now"
-- button, before Hermes exists to own delivery). Daily window, not per-minute
-- like ai-proxy — a report resend is an occasional action, and Resend's free
-- tier is 100/day, 3k/month shared across every user, so this caps one
-- account from exhausting it.
--
-- The Edge Function uses the service role (which bypasses RLS), so this table
-- has RLS enabled with NO policies: it is unreachable by anon/authenticated
-- clients directly.

create table if not exists public.report_mailer_rate_limit (
  user_id     uuid        not null,
  day         date        not null,
  count       int         not null default 0,
  primary key (user_id, day)
);

alter table public.report_mailer_rate_limit enable row level security;

-- Atomically bump the per-user counter for today and report whether the
-- request is still under `p_limit`. SECURITY DEFINER so the Edge Function can call it.
create or replace function public.bump_report_mailer_rate(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := current_date;
  c int;
begin
  insert into public.report_mailer_rate_limit (user_id, day, count)
    values (p_user_id, d, 1)
  on conflict (user_id, day)
    do update set count = public.report_mailer_rate_limit.count + 1
  returning count into c;

  -- Opportunistically purge old days so the table stays tiny.
  delete from public.report_mailer_rate_limit where day < current_date - interval '7 days';

  return c <= p_limit;
end;
$$;
