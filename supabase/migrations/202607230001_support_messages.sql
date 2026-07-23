-- Support messages submitted via the in-app support forms in Settings.
-- Every email, bug report, and support ticket is logged here so the
-- team can track, search, and respond without losing submissions to
-- spam or misconfigured email providers.
create table if not exists public.support_messages (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  category    text not null check (category in ('email', 'bug', 'ticket')),
  subject     text not null,
  message     text not null,
  sender_email text default '',
  priority    text default 'normal' check (priority in ('low', 'normal', 'high')),
  steps       text default '',
  status      text not null default 'new' check (status in ('new', 'read', 'replied', 'closed')),
  -- Optional user context so support knows who submitted it.
  user_id     uuid references auth.users(id) on delete set null,
  household_id uuid references public.households(id) on delete set null,
  household_name text default '',
  app_version text default '1.0'
);

-- Row-level security: only the master owner and service role can read.
alter table public.support_messages enable row level security;

-- Service role (edge function) can insert and read.
create policy "Service role full access"
  on public.support_messages
  for all
  to service_role
  using (true)
  with check (true);

-- Master owners can read messages from their own household.
create policy "Household owners can read their messages"
  on public.support_messages
  for select
  using (
    household_id is not null
    and exists (
      select 1 from public.household_members
      where household_members.household_id = support_messages.household_id
        and household_members.user_id = auth.uid()
        and household_members.role = 'owner'
    )
  );
