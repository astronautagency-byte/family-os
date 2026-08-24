-- Stripe billing cutover for the household-scoped Plus/Pro catalog.
-- Existing Chargebee identifiers remain readable for reconciliation, but new
-- checkout, portal, entitlement, and webhook writes use Stripe.

alter table public.account_subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_ends_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists canceled_at timestamptz,
  add column if not exists payment_method_brand text,
  add column if not exists payment_method_last4 text,
  add column if not exists addons text[] not null default '{}',
  add column if not exists member_count integer not null default 2;

create unique index if not exists account_subscriptions_stripe_customer_idx
  on public.account_subscriptions(stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists account_subscriptions_stripe_subscription_idx
  on public.account_subscriptions(stripe_subscription_id) where stripe_subscription_id is not null;

alter table public.account_subscriptions drop constraint if exists account_subscriptions_status_check;
alter table public.account_subscriptions add constraint account_subscriptions_status_check
  check (status in ('trial', 'trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete'));

-- The return type keeps chargebee_items for compatibility with already shipped
-- clients, but new Stripe rows expose their plan via plan and an empty legacy
-- item list.
drop function if exists public.get_my_subscription();
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
  select s.plan_key, s.status, s.amount_cents, s.billing_interval,
    coalesce(s.trial_ends_at, s.current_period_end),
    s.current_period_start,
    coalesce(s.current_period_ends_at, s.current_period_end),
    coalesce(s.cancel_at_period_end, false), s.canceled_at,
    s.payment_method_brand, s.payment_method_last4,
    coalesce(s.addons, '{}'::text[]), coalesce(s.member_count, 2), s.currency,
    coalesce(s.chargebee_items, '[]'::jsonb)
  from public.account_subscriptions s
  where s.household_id = (
    select hm.household_id from public.household_members hm
    where hm.user_id = auth.uid() limit 1
  )
  limit 1;
$$;

grant execute on function public.get_my_subscription() to authenticated;

-- Webhook-only upsert. The household id comes from Stripe metadata written by
-- create-checkout-session, never from an untrusted browser request.
drop function if exists public.upsert_from_stripe(uuid,text,text,text,integer,text,timestamptz,timestamptz,timestamptz,boolean,text,text,text[],integer,text);
drop function if exists public.upsert_from_stripe(uuid,text,text,text,text,integer,text,timestamptz,timestamptz,timestamptz,boolean,text,text,text[],integer,text);
create or replace function public.upsert_from_stripe(
  p_household_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_plan_key text,
  p_status text,
  p_amount_cents integer,
  p_billing_interval text,
  p_trial_ends_at timestamptz,
  p_current_period_start timestamptz,
  p_current_period_ends_at timestamptz,
  p_cancel_at_period_end boolean,
  p_payment_method_brand text,
  p_payment_method_last4 text,
  p_addons text[],
  p_member_count integer,
  p_currency text
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role only';
  end if;
  if not exists (select 1 from public.households where id = p_household_id) then
    raise exception 'Household not found';
  end if;
  insert into public.account_subscriptions (
    household_id, provider, plan_key, status, amount_cents, currency, billing_interval,
    external_customer_id, external_subscription_id,
    stripe_customer_id, stripe_subscription_id, trial_ends_at,
    current_period_start, current_period_ends_at, current_period_end,
    cancel_at_period_end, canceled_at, payment_method_brand, payment_method_last4,
    addons, member_count, updated_at
  ) values (
    p_household_id, 'stripe', coalesce(nullif(p_plan_key, ''), 'pro'), p_status,
    greatest(coalesce(p_amount_cents, 0), 0), upper(coalesce(p_currency, 'CAD')),
    case when p_billing_interval = 'year' then 'year' else 'month' end,
    p_stripe_customer_id, p_stripe_subscription_id,
    p_stripe_customer_id, p_stripe_subscription_id, p_trial_ends_at,
    p_current_period_start, p_current_period_ends_at, p_current_period_ends_at,
    coalesce(p_cancel_at_period_end, false),
    case when p_status = 'canceled' then now() else null end,
    coalesce(p_payment_method_brand, ''), coalesce(p_payment_method_last4, ''),
    coalesce(p_addons, '{}'::text[]), coalesce(p_member_count, 2), now()
  ) on conflict (household_id) do update set
    provider = 'stripe', plan_key = excluded.plan_key, status = excluded.status,
    amount_cents = excluded.amount_cents, currency = excluded.currency,
    billing_interval = excluded.billing_interval,
    external_customer_id = excluded.external_customer_id,
    external_subscription_id = excluded.external_subscription_id,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    trial_ends_at = excluded.trial_ends_at,
    current_period_start = excluded.current_period_start,
    current_period_ends_at = excluded.current_period_ends_at,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    canceled_at = case when excluded.status = 'canceled' then coalesce(account_subscriptions.canceled_at, now()) else null end,
    payment_method_brand = excluded.payment_method_brand,
    payment_method_last4 = excluded.payment_method_last4,
    addons = excluded.addons, member_count = excluded.member_count, updated_at = now();
end;
$$;
revoke all on function public.upsert_from_stripe(uuid,text,text,text,text,integer,text,timestamptz,timestamptz,timestamptz,boolean,text,text,text[],integer,text) from public;
grant execute on function public.upsert_from_stripe(uuid,text,text,text,text,integer,text,timestamptz,timestamptz,timestamptz,boolean,text,text,text[],integer,text) to service_role;

create or replace function public.has_household_feature(target_household uuid, feature_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select    feature_key in ('calendar', 'tasks', 'groceries', 'chat', 'kitchen')
  or exists (
    select 1 from public.account_subscriptions s
    where s.household_id = target_household
      and s.provider = 'stripe'
      and s.status in ('trial', 'trialing', 'active', 'past_due')
      and (s.status in ('active', 'past_due') or coalesce(s.trial_ends_at, s.current_period_end) is null or coalesce(s.trial_ends_at, s.current_period_end) > now())
      and (s.plan_key in ('plus', 'pro', 'family', 'free-plus-features') or feature_key = any(coalesce(s.addons, '{}'::text[])))
  )
  or exists (
    select 1 from public.account_subscriptions s
    where s.household_id = target_household
      and s.provider = 'promotion'
      and s.status in ('trial', 'active')
      and (s.current_period_end is null or s.current_period_end > now())
  )
  or exists (
    select 1
    from public.household_feature_overrides o
    where o.household_id = target_household
      and o.feature_key = feature_key
      and o.enabled = true
      and (
        o.reason is null
        or o.reason not like 'Promotion %'
        or exists (
          select 1
          from public.household_promo_redemptions r
          where r.household_id = o.household_id
            and o.reason = 'Promotion ' || r.promo_code
            and (r.expires_at is null or r.expires_at > now())
        )
      )
  );
$$;
revoke all on function public.has_household_feature(uuid, text) from public;
grant execute on function public.has_household_feature(uuid, text) to authenticated, service_role;

create or replace function public.get_my_entitlements()
returns jsonb language sql stable security definer set search_path = '' as $$
  with home as (
    select hm.household_id
    from public.household_members hm
    where hm.user_id = auth.uid()
    limit 1
  )
  select jsonb_build_object(
    'provider', coalesce(s.provider, 'core'),
    'plan', coalesce(s.plan_key, 'core'),
    'status', coalesce(s.status, 'free'),
    'trialEndsAt', s.trial_ends_at,
    'isOwner', h.created_by = auth.uid(),
    'features', jsonb_build_object(
      'calendar', true,
      'tasks', true,
      'groceries', true,
      'chat', true,
      'kitchen', true,
      'meals', public.has_household_feature(home.household_id, 'meals'),
      'fam_ai', public.has_household_feature(home.household_id, 'fam_ai'),
      'family', public.has_household_feature(home.household_id, 'family')
    )
  )
  from home
  join public.households h on h.id = home.household_id
  left join public.account_subscriptions s on s.household_id = home.household_id
  limit 1;
$$;
revoke all on function public.get_my_entitlements() from public;
grant execute on function public.get_my_entitlements() to authenticated;

select pg_notify('pgrst', 'reload schema');
