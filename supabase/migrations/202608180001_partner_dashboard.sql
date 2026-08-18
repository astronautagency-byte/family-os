-- ============================================================================
-- FamOS Partner Dashboard (self-serve)
-- Links ad_partners to a Supabase auth user and exposes partner-scoped RPCs.
-- ============================================================================

alter table public.ad_partners
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table public.ad_campaigns
  add column if not exists cpm_cents int not null default 700 check (cpm_cents >= 0);

create index if not exists ad_partners_user_idx on public.ad_partners(user_id);

-- ============================================================================
-- Storage: partner creative assets (public so they render as ad images)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-creatives', 'ad-creatives', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "authenticated upload ad creatives" on storage.objects;
create policy "authenticated upload ad creatives"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ad-creatives'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated update ad creatives" on storage.objects;
create policy "authenticated update ad creatives"
on storage.objects for update to authenticated
using (
  bucket_id = 'ad-creatives'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "authenticated delete ad creatives" on storage.objects;
create policy "authenticated delete ad creatives"
on storage.objects for delete to authenticated
using (
  bucket_id = 'ad-creatives'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "anyone read ad creatives" on storage.objects;
create policy "anyone read ad creatives"
on storage.objects for select to anon, authenticated
using (bucket_id = 'ad-creatives');

-- ============================================================================
-- Partner-scoped RPCs (security definer: partners may only touch their own)
-- ============================================================================

-- Current user's partner record (null if not a partner).
create or replace function public.get_my_partner()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select to_jsonb(p) from public.ad_partners p where p.user_id = auth.uid() limit 1),
    'null'
  );
$$;
grant execute on function public.get_my_partner() to authenticated;

-- Campaigns owned by the current partner (with live metrics).
create or replace function public.get_my_campaigns()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target_partner uuid;
begin
  select id into target_partner from public.ad_partners where user_id = auth.uid() limit 1;
  if target_partner is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(c order by c.created_at desc)
    from (
      select c.*,
             case when c.impressions > 0 then round((c.clicks::numeric / c.impressions) * 100, 2) else 0 end as ctr_pct,
             case when c.budget_cents > 0 then round((c.spent_cents::numeric / c.budget_cents) * 100, 1) else 0 end as budget_used_pct
      from public.ad_campaigns c
      where c.partner_id = target_partner
    ) c
  ), '[]'::jsonb);
end;
$$;
grant execute on function public.get_my_campaigns() to authenticated;

-- Create a campaign (always starts as draft; status must be set by partner dashboard).
create or replace function public.partner_create_campaign(
  p_name text,
  p_headline text,
  p_body_text text default '',
  p_cta_text text default 'Learn more',
  p_cta_url text default null,
  p_image_url text default '',
  p_placements text[] default '{}',
  p_product_categories text[] default '{}',
  p_target_family_min int default null,
  p_target_family_max int default null,
  p_target_countries text[] default '{}',
  p_target_regions text[] default '{}',
  p_target_cities text[] default '{}',
  p_target_postal_codes text[] default '{}',
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_budget_cents int default 0
) returns uuid security definer set search_path = '' as $$
declare
  target_partner uuid;
  new_id uuid;
begin
  select id into target_partner from public.ad_partners where user_id = auth.uid() limit 1;
  if target_partner is null then raise exception 'Partner access required'; end if;

  insert into public.ad_campaigns (
    partner_id, name, status, headline, body_text, cta_text, cta_url, image_url,
    placements, product_categories, target_family_min, target_family_max,
    target_countries, target_regions, target_cities, target_postal_codes,
    start_date, end_date, budget_cents
  ) values (
    target_partner, p_name, 'draft', p_headline, coalesce(p_body_text, ''), coalesce(p_cta_text, 'Learn more'),
    p_cta_url, coalesce(p_image_url, ''), coalesce(p_placements, '{}'), coalesce(p_product_categories, '{}'),
    p_target_family_min, p_target_family_max, coalesce(p_target_countries, '{}'),
    coalesce(p_target_regions, '{}'), coalesce(p_target_cities, '{}'), coalesce(p_target_postal_codes, '{}'),
    p_start_date, p_end_date, coalesce(p_budget_cents, 0)
  )
  returning id into new_id;

  return new_id;
end;
$$ language plpgsql;
grant execute on function public.partner_create_campaign(text, text, text, text, text, text, text[], text[], integer, integer, text[], text[], text[], text[], timestamptz, timestamptz, integer) to authenticated;

-- Update a campaign (only fields provided; empty-string clears optional fields).
create or replace function public.partner_update_campaign(
  p_campaign_id uuid,
  p_name text default null,
  p_headline text default null,
  p_body_text text default null,
  p_cta_text text default null,
  p_cta_url text default null,
  p_image_url text default null,
  p_placements text[] default null,
  p_product_categories text[] default null,
  p_target_family_min int default null,
  p_target_family_max int default null,
  p_target_countries text[] default null,
  p_target_regions text[] default null,
  p_target_cities text[] default null,
  p_target_postal_codes text[] default null,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_budget_cents int default null,
  p_status text default null
) returns void security definer set search_path = '' as $$
declare
  target_partner uuid;
begin
  select id into target_partner from public.ad_partners where user_id = auth.uid() limit 1;
  if target_partner is null then raise exception 'Partner access required'; end if;

  if not exists (select 1 from public.ad_campaigns where id = p_campaign_id and partner_id = target_partner) then
    raise exception 'Campaign not found';
  end if;

  update public.ad_campaigns set
    name = coalesce(p_name, name),
    headline = coalesce(p_headline, headline),
    body_text = coalesce(p_body_text, body_text),
    cta_text = coalesce(p_cta_text, cta_text),
    cta_url = coalesce(p_cta_url, cta_url),
    image_url = coalesce(p_image_url, image_url),
    placements = coalesce(p_placements, placements),
    product_categories = coalesce(p_product_categories, product_categories),
    target_family_min = coalesce(p_target_family_min, target_family_min),
    target_family_max = coalesce(p_target_family_max, target_family_max),
    target_countries = coalesce(p_target_countries, target_countries),
    target_regions = coalesce(p_target_regions, target_regions),
    target_cities = coalesce(p_target_cities, target_cities),
    target_postal_codes = coalesce(p_target_postal_codes, target_postal_codes),
    start_date = coalesce(p_start_date, start_date),
    end_date = coalesce(p_end_date, end_date),
    budget_cents = coalesce(p_budget_cents, budget_cents),
    status = coalesce(p_status, status),
    updated_at = now()
  where id = p_campaign_id;
end;
$$ language plpgsql;
grant execute on function public.partner_update_campaign(uuid, text, text, text, text, text, text, text[], text[], integer, integer, text[], text[], text[], text[], timestamptz, timestamptz, integer, text) to authenticated;

-- Delete a campaign owned by the current partner.
create or replace function public.partner_delete_campaign(p_campaign_id uuid)
returns void security definer set search_path = '' as $$
declare
  target_partner uuid;
begin
  select id into target_partner from public.ad_partners where user_id = auth.uid() limit 1;
  if target_partner is null then raise exception 'Partner access required'; end if;

  delete from public.ad_campaigns
  where id = p_campaign_id and partner_id = target_partner;
end;
$$ language plpgsql;
grant execute on function public.partner_delete_campaign(uuid) to authenticated;

-- Daily metrics for one of the current partner's campaigns.
create or replace function public.partner_campaign_metrics(p_campaign_id uuid)
returns jsonb stable security definer set search_path = '' as $$
declare
  target_partner uuid;
begin
  select id into target_partner from public.ad_partners where user_id = auth.uid() limit 1;
  if target_partner is null then return '[]'::jsonb; end if;

  if not exists (select 1 from public.ad_campaigns where id = p_campaign_id and partner_id = target_partner) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(row_to_jsonb order by day)
    from (
      select created_at::date as day,
             count(*) as impressions,
             count(*) filter (where clicked) as clicks
      from public.ad_impressions
      where campaign_id = p_campaign_id
      group by created_at::date
      order by created_at::date
    ) row_to_jsonb
  ), '[]'::jsonb);
end;
$$ language plpgsql;
grant execute on function public.partner_campaign_metrics(uuid) to authenticated;