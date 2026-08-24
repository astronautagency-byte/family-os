-- Update has_household_feature to recognize Stripe plan-based access.
-- Previous version checked Chargebee provider and chargebee_items column.
-- This version checks Stripe provider and plan_key column.

create or replace function public.has_household_feature(target_household uuid, feature_key text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_subscriptions s
    where s.household_id = target_household
      and s.provider = 'stripe'
      and s.status in ('active', 'trial', 'trialing', 'past_due')
      and (
        -- Pro gets everything
        s.plan_key = 'pro'
        -- Plus gets specific features
        or (s.plan_key = 'plus' and feature_key in ('meals', 'fam_ai', 'calendar_sync', 'groceries_enriched'))
        -- Trial users get full access
        or s.status in ('trial', 'trialing')
      )
  )
  or (
    -- Free tier: core features are always available
    feature_key in ('calendar', 'tasks', 'groceries', 'chat', 'kitchen')
  );
$$;

revoke all on function public.has_household_feature(uuid, text) from public;
grant execute on function public.has_household_feature(uuid, text) to authenticated, service_role;

-- Update the entitlements RPC to use Stripe data
create or replace function public.get_my_entitlements()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'features', jsonb_build_object(
      'calendar', true,
      'tasks', true,
      'groceries', true,
      'chat', true,
      'kitchen', true,
      'meals', public.has_household_feature(
        (select hm.household_id from public.household_members hm where hm.user_id = auth.uid() limit 1),
        'meals'
      ),
      'fam_ai', public.has_household_feature(
        (select hm.household_id from public.household_members hm where hm.user_id = auth.uid() limit 1),
        'fam_ai'
      ),
      'calendar_sync', public.has_household_feature(
        (select hm.household_id from public.household_members hm where hm.user_id = auth.uid() limit 1),
        'calendar_sync'
      ),
      'groceries_enriched', public.has_household_feature(
        (select hm.household_id from public.household_members hm where hm.user_id = auth.uid() limit 1),
        'groceries_enriched'
      )
    ),
    'plan', coalesce(
      (select s.plan_key from public.account_subscriptions s
       where s.household_id = (select hm.household_id from public.household_members hm where hm.user_id = auth.uid() limit 1)
       and s.status in ('active', 'trial', 'trialing') limit 1),
      'core'
    ),
    'status', coalesce(
      (select s.status from public.account_subscriptions s
       where s.household_id = (select hm.household_id from public.household_members hm where hm.user_id = auth.uid() limit 1)
       limit 1),
      'none'
    )
  );
$$;

grant execute on function public.get_my_entitlements() to authenticated;

notify pgrst, 'reload schema';
