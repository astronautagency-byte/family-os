-- Check if the current household has an active unlock_all promo redemption
-- Returns true if the household has a permanent promo unlock (not a trial promo)

create or replace function public.has_unlock_all_promo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_promo_redemptions hr
    join public.admin_promo_codes p on p.code = hr.promo_code
    where hr.household_id = (
      select hm.household_id
      from public.household_members hm
      where hm.user_id = auth.uid()
      limit 1
    )
    and p.benefit_type = 'unlock_all'
    and p.is_active = true
    and (hr.expires_at IS NULL OR hr.expires_at > now())
  );
$$;

grant execute on function public.has_unlock_all_promo() to authenticated;
