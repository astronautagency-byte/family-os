-- Atomic, household-scoped monthly API usage metering.
create table if not exists public.household_api_usage (
  household_id uuid not null references public.households(id) on delete cascade,
  metric text not null check (metric in ('famai_queries','premium_api_operations')),
  period_start date not null,
  used_count integer not null default 0 check (used_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (household_id, metric, period_start)
);

alter table public.household_api_usage enable row level security;
drop policy if exists "Household members view API usage" on public.household_api_usage;
create policy "Household members view API usage" on public.household_api_usage
  for select to authenticated using (public.is_household_member(household_id));

create or replace function public.consume_household_api_usage(
  target_household uuid,
  target_metric text,
  allowance integer
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  month_start date := date_trunc('month', timezone('utc', now()))::date;
  next_used integer;
  current_used integer;
begin
  if target_metric not in ('famai_queries','premium_api_operations') then raise exception 'Invalid usage metric'; end if;
  if allowance < 1 then return jsonb_build_object('allowed', false, 'used', 0, 'limit', greatest(allowance,0), 'remaining', 0, 'periodStart', month_start); end if;
  insert into public.household_api_usage(household_id,metric,period_start,used_count)
  values(target_household,target_metric,month_start,1)
  on conflict(household_id,metric,period_start) do update
    set used_count = public.household_api_usage.used_count + 1, updated_at = now()
    where public.household_api_usage.used_count < allowance
  returning used_count into next_used;
  if next_used is null then
    select used_count into current_used from public.household_api_usage where household_id=target_household and metric=target_metric and period_start=month_start;
    return jsonb_build_object('allowed', false, 'used', coalesce(current_used,allowance), 'limit', allowance, 'remaining', 0, 'periodStart', month_start);
  end if;
  return jsonb_build_object('allowed', true, 'used', next_used, 'limit', allowance, 'remaining', greatest(allowance-next_used,0), 'periodStart', month_start);
end $$;

revoke all on function public.consume_household_api_usage(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.consume_household_api_usage(uuid,text,integer) to service_role;

create or replace function public.get_my_api_usage()
returns table(metric text, used_count integer, period_start date)
language sql stable security definer set search_path = public as $$
  select u.metric,u.used_count,u.period_start
  from public.household_api_usage u
  where u.household_id=(select hm.household_id from public.household_members hm where hm.user_id=auth.uid() limit 1)
    and u.period_start=date_trunc('month',timezone('utc',now()))::date;
$$;
grant execute on function public.get_my_api_usage() to authenticated;

