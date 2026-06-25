-- Chronos cloud backend — initial schema.
-- One generic key-value table mirrors the app's localStorage stores (one row per
-- (user, domain): 'schedule', 'learning', 'chat', 'digests', 'daily-log', 'settings').
-- Row-Level Security pins every row to its owner via auth.uid() = user_id.

-- ── user_data: the synced app state ────────────────────────────────────────
create table if not exists public.user_data (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

create policy "user_data is private to its owner"
  on public.user_data
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on every write (so last-write-wins is server-authoritative).
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch
  before update on public.user_data
  for each row execute function public.touch_updated_at();

-- ── push_subscriptions: one row per device endpoint (for the notify function) ─
create table if not exists public.push_subscriptions (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  endpoint     text        not null,
  subscription jsonb       not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions are private to their owner"
  on public.push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
