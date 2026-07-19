alter table public.messages
  add column if not exists source text not null default 'famos',
  add column if not exists source_sender text;

alter table public.messages
  drop constraint if exists messages_source_check;
alter table public.messages
  add constraint messages_source_check check (source in ('famos', 'whatsapp'));

create table if not exists public.calendar_sharing_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  provider text not null default 'google',
  external_calendar_id text not null,
  calendar_name text not null default '',
  is_connected boolean not null default true,
  shared_with_household boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, external_calendar_id)
);

alter table public.calendar_sharing_preferences enable row level security;

drop policy if exists "members view calendar preferences" on public.calendar_sharing_preferences;
create policy "members view calendar preferences"
on public.calendar_sharing_preferences for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists "members manage own calendar preferences" on public.calendar_sharing_preferences;
create policy "members manage own calendar preferences"
on public.calendar_sharing_preferences for all to authenticated
using (user_id = auth.uid() and public.is_household_member(household_id))
with check (user_id = auth.uid() and public.is_household_member(household_id));

create index if not exists calendar_sharing_preferences_household_idx
  on public.calendar_sharing_preferences(household_id, shared_with_household);
