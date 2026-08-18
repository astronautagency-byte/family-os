-- Fix: Add 'meals' to free features so Free tier households can create meals
-- The RLS policy "entitled household meals" requires has_household_feature(household_id, 'meals')
-- which currently only returns true for Plus/Pro subscribers.
-- Since 202608170000 is already applied remotely, we only need to update the function definition.
-- Grants from 202608170000 are preserved by CREATE OR REPLACE.
create or replace function public.has_household_feature(target_household uuid, feature_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    feature_key in ('calendar', 'tasks', 'groceries', 'chat', 'kitchen', 'meals')
    -- Free features are always available.
    or exists (
      select 1 from public.account_subscriptions s
      where s.household_id = target_household
        and s.provider = 'chargebee'
        and s.status in ('trial', 'active')
        and (
          -- Plan-based access: 'plus' includes fam_ai, family features.
          (feature_key in ('fam_ai', 'family') and s.chargebee_items @> '["plus"]')
          -- 'pro' includes everything that 'plus' includes.
          or (feature_key in ('fam_ai', 'family') and s.chargebee_items @> '["pro"]')
          -- Direct feature match (for backwards compatibility).
          or s.chargebee_items @> jsonb_build_array(feature_key)
        )
    )
    -- Preserve access for households already paying through the retiring
    -- Stripe catalog until they are migrated to Chargebee.
    or exists (
      select 1 from public.account_subscriptions s
      where s.household_id = target_household
        and s.provider = 'stripe' and s.status in ('trial', 'active')
    )
    or exists (
      select 1 from public.household_feature_overrides o
      where o.household_id = target_household and o.feature_key = feature_key and o.enabled = true
    );
$$;

select pg_notify('pgrst', 'reload schema');