-- Plan & billing follow-up:
-- 1. get_my_subscription now returns chargebee_items so Settings can show the
--    active plan (Plus/Pro) instead of always falling back to "FamOS Free".
--    It also coalesces current_period_end (Chargebee writes this column)
--    with the legacy current_period_ends_at so the next-charge date shows.
-- 2. upsert_from_chargebee derives billing_interval from the term dates, so
--    yearly pre-paid subscriptions show "year" instead of "month".

create or replace function public.get_my_subscription()
returns table (
  plan text,
  status text,
  amount_cents integer,
  billing_interval text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean,
  canceled_at timestamptz,
  payment_method_brand text,
  payment_method_last4 text,
  addons text[],
  member_count integer,
  currency text,
  chargebee_items jsonb
)
language sql stable security invoker as $$
  select s.plan_key as plan, s.status, s.amount_cents, s.billing_interval,
         s.trial_ends_at, s.current_period_start,
         coalesce(s.current_period_ends_at, s.current_period_end),
         s.cancel_at_period_end, s.canceled_at,
         s.payment_method_brand, s.payment_method_last4, s.addons, s.member_count, s.currency,
         s.chargebee_items
  from public.account_subscriptions s
  where s.household_id = (
    select hm.household_id
    from public.household_members hm
    where hm.user_id = auth.uid()
    limit 1
  )
  limit 1;
$$;

create or replace function public.upsert_from_chargebee(
  target_household uuid, customer_id text, subscription_id text,
  next_status text, item_features jsonb, next_amount_cents integer,
  next_currency text, period_start timestamptz, period_end timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  interval_value text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'service_role only'; end if;
  -- A term of ~280+ days is a yearly plan (Chargebee yearly terms are 1 year);
  -- everything else falls back to monthly.
  interval_value := case
    when period_start is not null and period_end is not null
      and extract(epoch from (period_end - period_start)) >= 280 * 86400
    then 'year' else 'month' end;
  insert into public.account_subscriptions (
    household_id, provider, plan_key, status, amount_cents, currency, billing_interval,
    external_customer_id, external_subscription_id, chargebee_customer_id,
    chargebee_subscription_id, chargebee_items, current_period_start,
    current_period_end, started_at, updated_at
  ) values (
    target_household, 'chargebee', 'free-plus-features', next_status, greatest(next_amount_cents, 0),
    upper(next_currency), interval_value, customer_id, subscription_id, customer_id,
    subscription_id, item_features, period_start, period_end, now(), now()
  ) on conflict (household_id) do update set
    provider = 'chargebee', status = excluded.status, amount_cents = excluded.amount_cents,
    currency = excluded.currency, billing_interval = excluded.billing_interval,
    external_customer_id = excluded.external_customer_id,
    external_subscription_id = excluded.external_subscription_id,
    chargebee_customer_id = excluded.chargebee_customer_id,
    chargebee_subscription_id = excluded.chargebee_subscription_id,
    chargebee_items = excluded.chargebee_items,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end, updated_at = now();
end;
$$;
revoke all on function public.upsert_from_chargebee(uuid,text,text,text,jsonb,integer,text,timestamptz,timestamptz) from public;
grant execute on function public.upsert_from_chargebee(uuid,text,text,text,jsonb,integer,text,timestamptz,timestamptz) to service_role;
