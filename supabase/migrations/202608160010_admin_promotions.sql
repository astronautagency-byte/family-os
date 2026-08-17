-- Auditable promotion and trial controls for FamOS operators.
create table if not exists public.admin_promo_codes (
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  description text not null default '',
  benefit_type text not null check (benefit_type in ('unlock_all', 'trial')),
  trial_days integer check (trial_days between 1 and 365),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  redemption_count integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_promo_redemptions (
  household_id uuid not null references public.households(id) on delete cascade,
  promo_code text not null references public.admin_promo_codes(code),
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (household_id, promo_code)
);

alter table public.admin_promo_codes enable row level security;
alter table public.household_promo_redemptions enable row level security;
revoke all on public.admin_promo_codes, public.household_promo_redemptions from public, anon, authenticated;

create or replace function public.admin_list_promo_codes()
returns setof public.admin_promo_codes language sql stable security definer set search_path = '' as $$
  select p.* from public.admin_promo_codes p
  where public.is_famos_admin()
  order by p.created_at desc;
$$;

create or replace function public.admin_upsert_promo_code(
  next_code text, next_description text, next_benefit_type text,
  next_trial_days integer default null, next_max_redemptions integer default null,
  next_ends_at timestamptz default null, next_is_active boolean default true
) returns text language plpgsql security definer set search_path = '' as $$
declare normalized text := upper(trim(next_code));
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  if normalized !~ '^[A-Z0-9_-]{3,32}$' then raise exception 'Code must be 3–32 letters, numbers, dashes, or underscores'; end if;
  if next_benefit_type not in ('unlock_all','trial') then raise exception 'Invalid promotion type'; end if;
  if next_benefit_type = 'trial' and coalesce(next_trial_days, 0) not between 1 and 365 then raise exception 'Trial period must be 1–365 days'; end if;
  insert into public.admin_promo_codes(code, description, benefit_type, trial_days, max_redemptions, ends_at, is_active, created_by)
  values(normalized, coalesce(next_description,''), next_benefit_type,
    case when next_benefit_type = 'trial' then next_trial_days else null end,
    next_max_redemptions, next_ends_at, next_is_active, auth.uid())
  on conflict(code) do update set description=excluded.description, benefit_type=excluded.benefit_type,
    trial_days=excluded.trial_days, max_redemptions=excluded.max_redemptions,
    ends_at=excluded.ends_at, is_active=excluded.is_active, updated_at=now();
  perform public.admin_log('upsert_promo_code','promotion',normalized,jsonb_build_object('type',next_benefit_type,'trialDays',next_trial_days));
  return normalized;
end;
$$;

create or replace function public.admin_apply_promo_code(target_household uuid, promo_code text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare promo public.admin_promo_codes; expiry timestamptz;
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  select * into promo from public.admin_promo_codes where code=upper(trim(promo_code)) for update;
  if promo.code is null or not promo.is_active or promo.starts_at > now() or (promo.ends_at is not null and promo.ends_at < now()) then raise exception 'Promotion is not active'; end if;
  if promo.max_redemptions is not null and promo.redemption_count >= promo.max_redemptions then raise exception 'Promotion redemption limit reached'; end if;
  expiry := case when promo.benefit_type='trial' then now() + make_interval(days=>promo.trial_days) else null end;
  insert into public.household_promo_redemptions(household_id,promo_code,applied_by,expires_at)
  values(target_household,promo.code,auth.uid(),expiry) on conflict(household_id,promo_code) do update set applied_by=auth.uid(),applied_at=now(),expires_at=excluded.expires_at;
  update public.admin_promo_codes set redemption_count=redemption_count+1,updated_at=now() where code=promo.code;
  insert into public.household_account_status(household_id,status,note,updated_by,updated_at)
  values(target_household,case when promo.benefit_type='trial' then 'trial' else 'active' end,'Promotion '||promo.code,auth.uid(),now())
  on conflict(household_id) do update set status=excluded.status,note=excluded.note,updated_by=auth.uid(),updated_at=now();
  insert into public.household_feature_overrides(household_id,feature_key,enabled,reason,updated_by,updated_at)
  select target_household,key,true,'Promotion '||promo.code,auth.uid(),now() from public.feature_flags
  on conflict(household_id,feature_key) do update set enabled=true,reason=excluded.reason,updated_by=auth.uid(),updated_at=now();
  if promo.benefit_type='trial' then
    insert into public.account_subscriptions(household_id,provider,plan_key,status,amount_cents,currency,billing_interval,current_period_start,current_period_end,updated_at)
    values(target_household,'promotion','all-features-trial','trial',0,'CAD','month',now(),expiry,now())
    on conflict(household_id) do update set provider='promotion',plan_key='all-features-trial',status='trial',amount_cents=0,current_period_start=now(),current_period_end=expiry,updated_at=now();
  end if;
  perform public.admin_log('apply_promo_code','household',target_household::text,jsonb_build_object('code',promo.code,'expiresAt',expiry));
  return expiry;
end;
$$;

grant execute on function public.admin_list_promo_codes() to authenticated;
grant execute on function public.admin_upsert_promo_code(text,text,text,integer,integer,timestamptz,boolean) to authenticated;
grant execute on function public.admin_apply_promo_code(uuid,text) to authenticated;
