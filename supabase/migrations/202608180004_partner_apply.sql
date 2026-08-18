-- ============================================================================
-- Partner Self-Service Apply + Analytics Fields
-- ============================================================================

-- Add advertiser profile fields useful for future analytics/targeting
ALTER TABLE public.ad_partners
  ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_size text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS monthly_budget_range text NOT NULL DEFAULT '';

-- Self-service apply: creates a pending partner record for the current user
CREATE OR REPLACE FUNCTION public.partner_apply(
  p_company_name     text,
  p_website_url      text default '',
  p_contact_name     text default '',
  p_industry         text default '',
  p_company_size     text default '',
  p_monthly_budget   text default ''
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_existing uuid;
  v_partner record;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(p_company_name)) < 2 then
    raise exception 'Company name is required';
  end if;

  -- Check if user already has a partner record
  select id into v_existing from public.ad_partners where user_id = v_user limit 1;
  if v_existing is not null then
    -- Already applied — return current record
    select * into v_partner from public.ad_partners where id = v_existing;
    return jsonb_build_object(
      'id', v_partner.id,
      'status', v_partner.status,
      'company_name', v_partner.company_name,
      'existing', true
    );
  end if;

  -- Create new partner record (pending review)
  insert into public.ad_partners (
    company_name, contact_name, contact_email, website_url,
    industry, company_size, monthly_budget_range,
    user_id, status
  ) values (
    trim(p_company_name),
    trim(p_contact_name),
    coalesce((select email from auth.users where id = v_user), ''),
    trim(p_website_url),
    trim(p_industry),
    trim(p_company_size),
    trim(p_monthly_budget),
    v_user,
    'pending'
  )
  returning id, status, company_name into v_partner;

  return jsonb_build_object(
    'id', v_partner.id,
    'status', v_partner.status,
    'company_name', v_partner.company_name,
    'existing', false
  );
end;
$$;

GRANT EXECUTE ON FUNCTION public.partner_apply(text, text, text, text, text, text) TO authenticated;
