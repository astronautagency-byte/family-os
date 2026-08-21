-- User-facing promo code redemption: household members can apply an active
-- promo code to their own household during onboarding or from Settings.
-- This is the public-facing version of admin_apply_promo_code.

create or replace function public.apply_my_promo_code(promo_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  promo public.admin_promo_codes;
  home_id uuid;
  expiry timestamptz;
  result text;
begin
  -- Resolve the caller's household
  select hm.household_id into home_id
  from public.household_members hm
  where hm.user_id = auth.uid()
  limit 1;

  if home_id is null then
    raise exception 'Join or create a household first.';
  end if;

  -- Look up the promo code
  select * into promo
  from public.admin_promo_codes
  where code = upper(trim(promo_code))
  for update;

  if promo.code is null or not promo.is_active then
    raise exception 'This promo code is not active.';
  end if;

  if promo.starts_at > now() then
    raise exception 'This promo code is not yet active.';
  end if;

  if promo.ends_at is not null and promo.ends_at < now() then
    raise exception 'This promo code has expired.';
  end if;

  if promo.max_redemptions is not null and promo.redemption_count >= promo.max_redemptions then
    raise exception 'This promo code has reached its redemption limit.';
  end if;

  -- Check if this household already redeemed this code
  if exists (
    select 1 from public.household_promo_redemptions hr
    where hr.household_id = home_id and hr.promo_code = promo.code
  ) then
    raise exception 'Your household has already used this promo code.';
  end if;

  -- Calculate expiry for trial codes
  expiry := case
    when promo.benefit_type = 'trial' then now() + make_interval(days => promo.trial_days)
    else null
  end;

  -- Record the redemption
  insert into public.household_promo_redemptions(
    household_id, promo_code, applied_by, expires_at
  ) values (
    home_id, promo.code, auth.uid(), expiry
  );

  -- Increment redemption count
  update public.admin_promo_codes
  set redemption_count = redemption_count + 1, updated_at = now()
  where code = promo.code;

  -- Unlock features for this household
  insert into public.household_account_status(
    household_id, status, note, updated_by, updated_at
  ) values (
    home_id,
    case when promo.benefit_type = 'trial' then 'trial' else 'active' end,
    'Promotion ' || promo.code,
    auth.uid(),
    now()
  ) on conflict (household_id) do update set
    status = excluded.status,
    note = excluded.note,
    updated_by = auth.uid(),
    updated_at = now();

  -- Enable all features for the household
  insert into public.household_feature_overrides(
    household_id, feature_key, enabled, reason, updated_by, updated_at
  )
  select home_id, key, true, 'Promotion ' || promo.code, auth.uid(), now()
  from public.feature_flags
  on conflict (household_id, feature_key) do update set
    enabled = true,
    reason = excluded.reason,
    updated_by = auth.uid(),
    updated_at = now();

  -- For trial codes, also create an account_subscriptions entry
  if promo.benefit_type = 'trial' then
    insert into public.account_subscriptions(
      household_id, provider, plan_key, status, amount_cents, currency,
      billing_interval, current_period_start, current_period_end, updated_at
    ) values (
      home_id, 'promotion', 'all-features-trial', 'trial', 0, 'CAD',
      'month', now(), expiry, now()
    ) on conflict (household_id) do update set
      provider = 'promotion',
      plan_key = 'all-features-trial',
      status = 'trial',
      amount_cents = 0,
      current_period_start = now(),
      current_period_end = excluded.current_period_end,
      updated_at = now();
  end if;

  -- Format result message
  result := case
    when promo.benefit_type = 'trial' then
      'All features unlocked for ' || promo.trial_days || ' days!'
    else
      'All features unlocked permanently!'
  end;

  return result;
end;
$$;

revoke all on function public.apply_my_promo_code(text) from public;
grant execute on function public.apply_my_promo_code(text) to authenticated;
