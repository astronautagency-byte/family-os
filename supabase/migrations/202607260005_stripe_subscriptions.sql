-- Stripe-backed subscriptions: 30-day trial with card collected at trial start,
-- then auto-billing via Stripe Checkout + Customer Portal. Webhook keeps the
-- account_subscriptions row in sync. Settings page reads via get_my_subscription().

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
  add column if not exists member_count integer not null default 2,
  add column if not exists currency text not null default 'usd';

create index if not exists idx_account_subscriptions_stripe_customer
  on public.account_subscriptions(stripe_customer_id);
create index if not exists idx_account_subscriptions_stripe_sub
  on public.account_subscriptions(stripe_subscription_id);

-- Extend status enum to include Stripe's 'trialing' (sits next to our existing
-- 'trial' for back-compat with admin records) and 'incomplete'.
alter table public.account_subscriptions
  drop constraint if exists account_subscriptions_status_check;
alter table public.account_subscriptions
  add constraint account_subscriptions_status_check
    check (status in ('trial', 'trialing', 'active', 'past_due', 'canceled', 'paused', 'incomplete'));

-- get_my_subscription: Settings → Plan & billing card uses this. Returns one
-- row per household (account), so the user doesn't need to know their account_id.
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
  currency text
)
language sql stable security invoker as $$
  select s.plan_key as plan, s.status, s.amount_cents, s.billing_interval,
         s.trial_ends_at, s.current_period_start, s.current_period_ends_at,
         s.cancel_at_period_end, s.canceled_at,
         s.payment_method_brand, s.payment_method_last4, s.addons, s.member_count, s.currency
  from public.account_subscriptions s
  where s.household_id = (
    select hm.household_id
    from public.household_members hm
    where hm.user_id = auth.uid()
    limit 1
  )
  limit 1;
$$;

-- upsert_from_stripe: webhook handler uses this. Service-role only.
-- Idempotent on (account_id) — re-firing the same webhook event shouldn't
-- double-write or duplicate subscriptions.
create or replace function public.upsert_from_stripe(
  p_account_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
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
returns void
language plpgsql security definer as $$
declare
  existing_id uuid;
begin
  -- Restrict to service-role caller
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role only';
  end if;

  select household_id into existing_id
    from public.account_subscriptions
    where household_id = p_account_id
    limit 1;

  if existing_id is null then
    insert into public.account_subscriptions (
      household_id, provider, plan_key, status, amount_cents, billing_interval,
      stripe_customer_id, stripe_subscription_id,
      trial_ends_at, current_period_start, current_period_ends_at,
      cancel_at_period_end,
      payment_method_brand, payment_method_last4, addons, member_count, currency, updated_at
    ) values (
      p_account_id, 'stripe', 'core', p_status, p_amount_cents, p_billing_interval,
      p_stripe_customer_id, p_stripe_subscription_id,
      p_trial_ends_at, p_current_period_start, p_current_period_ends_at,
      p_cancel_at_period_end,
      p_payment_method_brand, p_payment_method_last4, p_addons, p_member_count, p_currency, now()
    );
  else
    update public.account_subscriptions set
      status = p_status,
      amount_cents = p_amount_cents,
      billing_interval = p_billing_interval,
      stripe_customer_id = p_stripe_customer_id,
      stripe_subscription_id = p_stripe_subscription_id,
      trial_ends_at = p_trial_ends_at,
      current_period_start = p_current_period_start,
      current_period_ends_at = p_current_period_ends_at,
      cancel_at_period_end = p_cancel_at_period_end,
      payment_method_brand = p_payment_method_brand,
      payment_method_last4 = p_payment_method_last4,
      addons = p_addons,
      member_count = p_member_count,
      currency = p_currency,
      canceled_at = case when p_status in ('canceled', 'incomplete_expired') then coalesce(canceled_at, now()) else canceled_at end,
      updated_at = now()
    where household_id = p_account_id;
  end if;
end;
$$;

-- map_stripe_status exposed for the webhook handler if it wants to keep its
-- mapping in SQL (kept simple here — webhook can also do the mapping inline).
-- This function is intentionally tiny + readable so future Stripe status
-- additions stay a one-line change.
create or replace function public.map_stripe_status(p_status text)
returns text
language sql immutable as $$
  select case
    when p_status = 'trialing' then 'trial'
    when p_status = 'active' then 'active'
    when p_status = 'past_due' then 'past_due'
    when p_status = 'canceled' then 'canceled'
    when p_status = 'unpaid' or p_status = 'incomplete' or p_status = 'incomplete_expired' then 'incomplete'
    when p_status = 'paused' then 'paused'
    else 'incomplete'
  end;
$$;
