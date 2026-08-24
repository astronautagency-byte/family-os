-- Google Calendar OAuth tokens for sync
create table if not exists public.google_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token text,
  access_token text,
  token_expiry timestamptz,
  scope text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

comment on table public.google_calendar_tokens is 'Stores Google OAuth tokens for calendar sync per user.';
alter table public.google_calendar_tokens enable row level security;

create policy "users manage own google tokens"
on public.google_calendar_tokens for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "service role manages google tokens"
on public.google_calendar_tokens for all to service_role
using (true)
with check (true);

-- Add source and external_id to events if not present
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'events' and column_name = 'source'
  ) then
    alter table public.events add column source text default 'familyos';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'events' and column_name = 'external_id'
  ) then
    alter table public.events add column external_id text;
  end if;
end $$;

-- Add source and external_id to tasks if not present
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'tasks' and column_name = 'source'
  ) then
    alter table public.tasks add column source text default 'familyos';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'tasks' and column_name = 'external_id'
  ) then
    alter table public.tasks add column external_id text;
  end if;
end $$;

-- Index for deduplication on external sync
create index if not exists events_source_external_idx
on public.events (household_id, source, external_id);

create index if not exists tasks_source_external_idx
on public.tasks (household_id, source, external_id);

notify pgrst, 'reload schema';
