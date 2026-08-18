-- ============================================================================
-- FamOS Ad Network
-- Partners can target ads by placement, product, family size, and location.
-- ============================================================================

-- Ad partners (advertisers)
create table if not exists public.ad_partners (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(company_name) between 1 and 300),
  contact_name text not null default '',
  contact_email text not null check (char_length(contact_email) between 3 and 320),
  website_url text not null default '',
  logo_url text not null default '',
  status text not null default 'pending' check (status in ('pending','active','paused','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ad campaigns with targeting
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.ad_partners(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'draft' check (status in ('draft','active','paused','ended')),
  -- Creative
  headline text not null check (char_length(headline) between 1 and 200),
  body_text text not null default '',
  cta_text text not null default 'Learn more',
  cta_url text not null,
  image_url text not null default '',
  -- Placement targeting (which surfaces): home, calendar, meals, shopping, tasks
  placements text[] not null default '{}',
  -- Product targeting (which product verticals the creative is relevant to)
  product_categories text[] not null default '{}',
  -- Family size targeting (inclusive range on household_profiles.family_size)
  target_family_min int,
  target_family_max int,
  -- Location targeting (match on household_profiles country/region/city/postal)
  target_countries text[] not null default '{}',
  target_regions text[] not null default '{}',
  target_cities text[] not null default '{}',
  target_postal_codes text[] not null default '{}',
  -- Schedule + budget
  start_date timestamptz,
  end_date timestamptz,
  budget_cents int not null default 0 check (budget_cents >= 0),
  spent_cents int not null default 0 check (spent_cents >= 0),
  impressions int not null default 0,
  clicks int not null default 0 check (clicks <= impressions),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_campaigns_status_idx on public.ad_campaigns(status) where status = 'active';
create index if not exists ad_campaigns_partner_idx on public.ad_campaigns(partner_id);

-- Impression/click events
create table if not exists public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  placement text not null,
  clicked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ad_impressions_campaign_idx on public.ad_impressions(campaign_id, created_at);
create index if not exists ad_impressions_household_idx on public.ad_impressions(household_id);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.ad_partners enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_impressions enable row level security;

-- Partners + campaigns: admin-only. Serving happens via security-definer RPCs.
drop policy if exists "admins manage ad partners" on public.ad_partners;
create policy "admins manage ad partners" on public.ad_partners
for all to authenticated using (public.is_famos_admin()) with check (public.is_famos_admin());

drop policy if exists "admins manage ad campaigns" on public.ad_campaigns;
create policy "admins manage ad campaigns" on public.ad_campaigns
for all to authenticated using (public.is_famos_admin()) with check (public.is_famos_admin());

-- Impressions: members record their own; admins read all.
drop policy if exists "members record own impressions" on public.ad_impressions;
create policy "members record own impressions" on public.ad_impressions
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "admins read impressions" on public.ad_impressions;
create policy "admins read impressions" on public.ad_impressions
for select to authenticated using (public.is_famos_admin());

-- ============================================================================
-- Helpers
-- ============================================================================

-- True when the household has an active paid subscription (chargebee or stripe).
create or replace function public.household_has_paid_subscription(target_household uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_subscriptions s
    where s.household_id = target_household
      and s.provider in ('chargebee', 'stripe')
      and s.status in ('trial', 'active')
  );
$$;
grant execute on function public.household_has_paid_subscription(uuid) to authenticated;

-- Serve ads for a placement to the current user's household.
-- Returns { paid: bool, ads: [...campaign rows] } — paid households get no ads.
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

  select coalesce(jsonb_agg(row_to_jsonb), '[]') into response
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
      -- placement targeting: campaign must target this placement
      and (cardinality(c.placements) = 0 or p_placement = any(c.placements))
      -- family size targeting
      and (c.target_family_min is null or hp.family_size is null or hp.family_size >= c.target_family_min)
      and (c.target_family_max is null or hp.family_size is null or hp.family_size <= c.target_family_max)
      -- location targeting (any match within a class unlocks; all classes must match if set)
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

-- Record an impression (or click) from the current member.
create or replace function public.record_ad_impression(p_campaign_id uuid, p_placement text, p_clicked boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_household uuid;
  family_count int;
begin
  select hm.household_id into target_household
  from public.household_members hm
  where hm.user_id = auth.uid()
  limit 1;

  if target_household is null then return; end if;

  insert into public.ad_impressions (campaign_id, household_id, user_id, placement, clicked)
  values (p_campaign_id, target_household, auth.uid(), p_placement, coalesce(p_clicked, false));

  update public.ad_campaigns c
  set impressions = c.impressions + 1,
      clicks = c.clicks + case when coalesce(p_clicked, false) then 1 else 0 end
  where c.id = p_campaign_id;
end;
$$;
grant execute on function public.record_ad_impression(uuid, text, boolean) to authenticated;

alter table public.ad_campaigns replica identity full;