-- Onboarding email lifecycle tracking.
-- Each row represents one lifecycle email sent to a household member.
-- The app queries this table to decide which emails are due and which
-- have already been delivered.

create table if not exists public.onboarding_emails (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null,
  status text not null default 'queued',  -- queued | sending | sent | delivered | failed
  resend_message_id text,
  error_message text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(household_id, user_id, email_type)
);

comment on table public.onboarding_emails is 'Tracks onboarding lifecycle emails sent to household members.';
comment on column public.onboarding_emails.email_type is 'Lifecycle email type: welcome, day1_quick_wins, day3_tips, day7_recap, day14_missing, day21_nudge, day28_final.';

-- RLS: members can read their own household's emails
alter table public.onboarding_emails enable row level security;

create policy "members read onboarding emails"
on public.onboarding_emails for select to authenticated
using (
  exists (
    select 1 from public.household_members hm
    where hm.user_id = auth.uid()
      and hm.household_id = onboarding_emails.household_id
  )
);

-- Only service role writes (via edge functions)
create policy "service role manages onboarding emails"
on public.onboarding_emails for all to service_role
using (true)
with check (true);

-- Index for the lifecycle check query: "what emails is this user due for?"
create index if not exists onboarding_emails_due_idx
on public.onboarding_emails (household_id, user_id, email_type, status);

notify pgrst, 'reload schema';
