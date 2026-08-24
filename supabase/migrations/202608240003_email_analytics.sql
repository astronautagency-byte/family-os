-- Email analytics events — tracks opens and clicks for onboarding lifecycle emails.
-- Each row is one tracking event (open or click) tied to a specific email send.

create table if not exists public.onboarding_email_events (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.onboarding_emails(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null,
  event_type text not null,  -- open | click
  link_url text,             -- NULL for opens, the clicked URL for clicks
  user_agent text,
  ip_address inet,
  created_at timestamptz not null default now()
);

comment on table public.onboarding_email_events is 'Tracks open and click events for onboarding lifecycle emails.';
comment on column public.onboarding_email_events.event_type is 'Type of tracking event: open (pixel load) or click (link follow).';
comment on column public.onboarding_email_events.link_url is 'The destination URL that was clicked. NULL for open events.';

-- RLS: service role writes, admins read
alter table public.onboarding_email_events enable row level security;

create policy "service role manages email events"
on public.onboarding_email_events for all to service_role
using (true)
with check (true);

create policy "admins read email events"
on public.onboarding_email_events for select to authenticated
using (
  exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.is_active = true
  )
);

-- Indexes for common queries
create index if not exists onboarding_email_events_email_idx
on public.onboarding_email_events (email_id, event_type);

create index if not exists onboarding_email_events_household_idx
on public.onboarding_email_events (household_id, email_type, event_type, created_at);

create index if not exists onboarding_email_events_type_idx
on public.onboarding_email_events (email_type, event_type, created_at);

-- Materialized summary view for dashboard queries
create or replace view public.onboarding_email_stats as
select
  oe.email_type,
  count(distinct oe.id) as total_sent,
  count(distinct case when ev.event_type = 'open' then ev.email_id end) as unique_opens,
  count(distinct case when ev.event_type = 'click' then ev.email_id end) as unique_clicks,
  count(case when ev.event_type = 'open' then 1 end) as total_opens,
  count(case when ev.event_type = 'click' then 1 end) as total_clicks,
  round(
    100.0 * count(distinct case when ev.event_type = 'open' then ev.email_id end)
    / nullif(count(distinct oe.id), 0),
    1
  ) as open_rate_pct,
  round(
    100.0 * count(distinct case when ev.event_type = 'click' then ev.email_id end)
    / nullif(count(distinct case when ev.event_type = 'open' then ev.email_id end), 0),
    1
  ) as click_through_rate_pct
from public.onboarding_emails oe
left join public.onboarding_email_events ev on ev.email_id = oe.id
where oe.status = 'sent'
group by oe.email_type;

comment on view public.onboarding_email_stats is 'Aggregated open/click rates per lifecycle email type.';

notify pgrst, 'reload schema';
