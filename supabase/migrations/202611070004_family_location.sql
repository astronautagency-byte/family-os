-- One latest, voluntarily shared position per person and household; no trail.
create table public.family_locations (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m >= 0 and accuracy_m <= 100000),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (household_id, user_id)
);
alter table public.family_locations enable row level security;
revoke all on public.family_locations from public, anon, authenticated;

create function public.share_family_location(h uuid, lat double precision, lon double precision, accuracy double precision)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_household_member(h) then raise exception 'Household membership required'; end if;
  if exists (select 1 from public.household_feature_preferences where household_id=h and features->>'location'='false') then raise exception 'Family location is disabled'; end if;
  if lat is null or lon is null or accuracy is null or lat not between -90 and 90 or lon not between -180 and 180 or accuracy not between 0 and 100000 then raise exception 'Invalid location'; end if;
  insert into public.family_locations (household_id,user_id,latitude,longitude,accuracy_m,updated_at,expires_at)
  values (h,auth.uid(),lat,lon,accuracy,now(),now()+interval '30 minutes')
  on conflict (household_id,user_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,updated_at=excluded.updated_at,expires_at=excluded.expires_at;
end $$;

create function public.get_family_locations(h uuid)
returns table(user_id uuid, latitude double precision, longitude double precision, accuracy_m double precision, updated_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_household_member(h) then raise exception 'Household membership required'; end if;
  if exists (select 1 from public.household_feature_preferences where household_id=h and features->>'location'='false') then raise exception 'Family location is disabled'; end if;
  return query select l.user_id,l.latitude,l.longitude,l.accuracy_m,l.updated_at,l.expires_at
    from public.family_locations l join public.household_members m on m.household_id=l.household_id and m.user_id=l.user_id
    where l.household_id=h and l.expires_at>now();
end $$;

create function public.stop_family_location(h uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.family_locations where household_id=h and user_id=auth.uid();
end $$;

revoke all on function public.share_family_location(uuid,double precision,double precision,double precision), public.get_family_locations(uuid), public.stop_family_location(uuid) from public,anon;
grant execute on function public.share_family_location(uuid,double precision,double precision,double precision), public.get_family_locations(uuid), public.stop_family_location(uuid) to authenticated;

-- Check-ins are voluntary and independent of location permission.
create table public.family_checkins (
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 checked_at timestamptz not null default now(),
 primary key(household_id,user_id)
);
alter table public.family_checkins enable row level security;
revoke all on public.family_checkins from public,anon,authenticated;
create function public.send_family_checkin(h uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_household_member(h) then raise exception 'Household membership required'; end if;
 if exists(select 1 from public.household_feature_preferences where household_id=h and features->>'location'='false') then raise exception 'Family location is disabled'; end if;
 insert into public.family_checkins(household_id,user_id,checked_at) values(h,auth.uid(),now())
 on conflict(household_id,user_id) do update set checked_at=excluded.checked_at;
end $$;
create function public.get_family_checkins(h uuid) returns table(user_id uuid,checked_at timestamptz) language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_household_member(h) then raise exception 'Household membership required'; end if;
 if exists(select 1 from public.household_feature_preferences where household_id=h and features->>'location'='false') then raise exception 'Family location is disabled'; end if;
 return query select c.user_id,c.checked_at from public.family_checkins c join public.household_members m on m.household_id=c.household_id and m.user_id=c.user_id where c.household_id=h and c.checked_at>now()-interval '24 hours';
end $$;
revoke all on function public.send_family_checkin(uuid),public.get_family_checkins(uuid) from public,anon;
grant execute on function public.send_family_checkin(uuid),public.get_family_checkins(uuid) to authenticated;

-- Add the page to the existing owner-controlled customization allowlist.
create or replace function public.set_household_features(h uuid, selection jsonb, pause boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.rewardbank_is_parent(h) then raise exception 'Only the household owner can customize FamOS'; end if;
 if selection is null or jsonb_typeof(selection)<>'object' or exists(
  select 1 from jsonb_each(selection) e where e.key not in ('calendar','tasks','groceries','kitchen','meals','recipes','rewards','chat','fam_ai','insights','celebrations','routine_suggestions','family_packs','location') or jsonb_typeof(e.value)<>'boolean'
 ) then raise exception 'Invalid feature selection'; end if;
 insert into public.household_feature_preferences(household_id,features,pause_reminders) values(h,selection,coalesce(pause,false))
 on conflict(household_id) do update set features=excluded.features,pause_reminders=excluded.pause_reminders,updated_at=now();
end $$;
notify pgrst, 'reload schema';
