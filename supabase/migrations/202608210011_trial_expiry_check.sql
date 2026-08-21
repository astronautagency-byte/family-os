-- Fix: has_household_feature must check trial expiry date.
-- When a trial's current_period_end has passed, the household should
-- drop back to core (free) features only.

create or replace function public.has_household_feature(target_household uuid, feature_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    feature_key in ('calendar', 'tasks', 'groceries', 'chat', 'kitchen', 'meals')
    or exists (
      select 1 from public.account_subscriptions s
      where s.household_id = target_household
        and s.provider = 'chargebee'
        and s.status in ('trial', 'active')
        and (
          -- For trial subscriptions, check that the trial hasn't expired
          s.status = 'active'
          or (s.status = 'trial' and s.current_period_end is not null and s.current_period_end > now())
          or (s.status = 'trial' and s.current_period_end is null)
        )
        and (
          -- Plan-based access: 'plus' includes fam_ai, family features.
          (feature_key in ('fam_ai', 'family') and s.chargebee_items @> '["plus"]')
          -- 'pro' includes everything that 'plus' includes.
          or (feature_key in ('fam_ai', 'family') and s.chargebee_items @> '["pro"]')
          -- Direct feature match (for backwards compatibility).
          or s.chargebee_items @> jsonb_build_array(feature_key)
        )
    )
    or exists (
      select 1 from public.account_subscriptions s
      where s.household_id = target_household
        and s.provider = 'stripe'
        and s.status in ('trial', 'active')
        and (
          s.status = 'active'
          or (s.status = 'trial' and s.current_period_end is not null and s.current_period_end > now())
          or (s.status = 'trial' and s.current_period_end is null)
        )
    )
    or exists (
      select 1 from public.household_feature_overrides o
      where o.household_id = target_household and o.feature_key = feature_key and o.enabled = true
    );
$$;

select pg_notify('pgrst', 'reload schema');
