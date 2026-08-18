-- Fix get_my_ads: row_to_jsonb was not a valid expression; use to_jsonb(c).
create or replace function public.get_my_ads(p_placement text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target_household uuid;
  response jsonb;
begin
  select hm.household_id into target_household
  from public.household_members hm
  where hm.user_id = auth.uid()
  limit 1;

  if target_household is null then
    return jsonb_build_object('paid', false, 'ads', '[]');
  end if;

  if public.household_has_paid_subscription(target_household) then
    return jsonb_build_object('paid', true, 'ads', '[]');
  end if;

  select coalesce(jsonb_agg(to_jsonb(c)), '[]') into response
  from (
    select c.*
    from public.ad_campaigns c
    join public.ad_partners p on p.id = c.partner_id
    cross join lateral (
      select hp.family_size, hp.country, hp.region, hp.city, hp.postal_code
      from public.household_profiles hp
      where hp.household_id = target_household
    ) hp
    where c.status = 'active'
      and p.status = 'active'
      and (c.start_date is null or c.start_date <= now())
      and (c.end_date is null or c.end_date >= now())
      and (c.budget_cents = 0 or c.spent_cents < c.budget_cents)
      and (cardinality(c.placements) = 0 or p_placement = any(c.placements))
      and (c.target_family_min is null or hp.family_size is null or hp.family_size >= c.target_family_min)
      and (c.target_family_max is null or hp.family_size is null or hp.family_size <= c.target_family_max)
      and (cardinality(c.target_countries) = 0 or coalesce(hp.country,'') = any(c.target_countries))
      and (cardinality(c.target_regions) = 0 or coalesce(hp.region,'') = any(c.target_regions))
      and (cardinality(c.target_cities) = 0 or coalesce(hp.city,'') = any(c.target_cities))
      and (cardinality(c.target_postal_codes) = 0 or coalesce(hp.postal_code,'') = any(c.target_postal_codes))
    order by random()
    limit 3
  ) c;

  return jsonb_build_object('paid', false, 'ads', response);
end;
$$;
grant execute on function public.get_my_ads(text) to authenticated;
