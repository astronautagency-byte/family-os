-- Temporary launch mode: keep the billing integration deployed, but do not
-- gate household features until the Chargebee catalogue is ready.
create or replace function public.has_household_feature(target_household uuid, feature_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_household_member(target_household);
$$;

revoke all on function public.has_household_feature(uuid, text) from public;
grant execute on function public.has_household_feature(uuid, text) to authenticated, service_role;

create or replace function public.get_my_entitlements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with home as (
    select hm.household_id
    from public.household_members hm
    where hm.user_id = auth.uid()
    limit 1
  )
  select jsonb_build_object(
    'provider', 'launch_access',
    'status', 'active',
    'isOwner', h.created_by = auth.uid(),
    'features', jsonb_build_object(
      'calendar', true,
      'tasks', true,
      'groceries', true,
      'chat', true,
      'kitchen', true,
      'meals', true,
      'fam_ai', true,
      'family', true
    )
  )
  from home
  join public.households h on h.id = home.household_id;
$$;

revoke all on function public.get_my_entitlements() from public;
grant execute on function public.get_my_entitlements() to authenticated;
