-- AI proxy rate limiting
-- Backs the `ai-proxy` Edge Function so a shared (server-held) Gemini key can be
-- offered to demo visitors without exposing it, while capping per-IP abuse/cost.
--
-- The Edge Function uses the service role (which bypasses RLS), so this table has
-- RLS enabled with NO policies: it is unreachable by anon/authenticated clients.

create table if not exists public.ai_proxy_rate_limit (
  ip            text        not null,
  window_start  timestamptz not null,
  count         int         not null default 0,
  primary key (ip, window_start)
);

alter table public.ai_proxy_rate_limit enable row level security;

-- Atomically bump the per-IP counter for the current minute and report whether the
-- request is still under `p_limit`. SECURITY DEFINER so the Edge Function can call it.
create or replace function public.bump_ai_proxy_rate(p_ip text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz := date_trunc('minute', now());
  c int;
begin
  insert into public.ai_proxy_rate_limit (ip, window_start, count)
    values (p_ip, w, 1)
  on conflict (ip, window_start)
    do update set count = public.ai_proxy_rate_limit.count + 1
  returning count into c;

  -- Opportunistically purge old windows so the table stays tiny.
  delete from public.ai_proxy_rate_limit where window_start < now() - interval '10 minutes';

  return c <= p_limit;
end;
$$;
