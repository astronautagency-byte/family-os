-- Per-device jobs prevent a successful device from being retried just because
-- a different device failed. Only trusted server functions may enqueue/send.
create table public.reminder_deliveries (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 subscription_id uuid references public.push_subscriptions(id) on delete cascade,
 notification jsonb not null,
 due_at timestamptz not null,
 status text not null default 'pending' check (status in ('pending','processing','accepted','failed')),
 attempts integer not null default 0,
 locked_until timestamptz,
 claim_token uuid,
 last_error text,
 created_at timestamptz not null default now()
);
alter table public.reminder_deliveries enable row level security;
create index reminder_deliveries_due on public.reminder_deliveries(due_at) where status in ('pending','processing');
create or replace function public.claim_reminder_deliveries()
returns setof public.reminder_deliveries language sql security definer set search_path = '' as $$
 update public.reminder_deliveries d
 set status='processing', attempts=d.attempts+1, locked_until=now()+interval '5 minutes', claim_token=gen_random_uuid()
 where d.id in (
  select id from public.reminder_deliveries
  where due_at<=now() and attempts<3
   and (status='pending' or (status='processing' and locked_until<now()))
  order by due_at for update skip locked limit 5
 ) returning d.*;
$$;
revoke all on function public.claim_reminder_deliveries() from public, anon, authenticated;
grant execute on function public.claim_reminder_deliveries() to service_role;
