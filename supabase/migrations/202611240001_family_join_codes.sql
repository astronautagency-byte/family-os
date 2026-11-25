-- Codes create approval requests. Only the existing email-bound invitation flow grants membership.
create table public.family_join_codes (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 code_hash text not null unique,
 created_by uuid not null references public.profiles(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '48 hours',
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.family_join_requests (
 id uuid primary key default gen_random_uuid(),
 code_id uuid not null references public.family_join_codes(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 invitation_id uuid references public.household_invitations(id) on delete set null,
 status text not null default 'pending' check(status in ('pending','approved','declined')),
 created_at timestamptz not null default now(),
 unique(code_id,user_id)
);
create table public.family_join_attempts (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 window_start timestamptz not null default now(),
 attempts integer not null default 0
);
alter table public.family_join_codes enable row level security;
alter table public.family_join_requests enable row level security;
alter table public.family_join_attempts enable row level security;
revoke all on public.family_join_codes,public.family_join_requests,public.family_join_attempts from anon,authenticated;

create function public.family_join(action text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 caller uuid:=auth.uid(); home uuid; target public.family_join_codes; request_row public.family_join_requests;
 code text; request_email text; attempt_count integer; result jsonb;
begin
 if caller is null then raise exception 'Sign in required'; end if;
 if action='request' then
  if exists(select 1 from public.household_members where user_id=caller) then
   return jsonb_build_object('error','You already belong to a household.');
  end if;
  if not exists(select 1 from auth.users where id=caller and email_confirmed_at is not null) then
   return jsonb_build_object('error','Verify your email before requesting access.');
  end if;
  insert into public.family_join_attempts(user_id,attempts) values(caller,1)
  on conflict(user_id) do update set
   attempts=case when public.family_join_attempts.window_start < now()-interval '15 minutes' then 1 else public.family_join_attempts.attempts+1 end,
   window_start=case when public.family_join_attempts.window_start < now()-interval '15 minutes' then now() else public.family_join_attempts.window_start end
  returning attempts into attempt_count;
  if attempt_count>10 then return jsonb_build_object('error','Too many attempts. Try again in 15 minutes.'); end if;
  code:=upper(regexp_replace(coalesce(payload->>'code',''),'[^a-zA-Z0-9]','','g'));
  select * into target from public.family_join_codes where code_hash=encode(sha256(convert_to(code,'UTF8')),'hex') for update;
  if not found or target.revoked_at is not null or target.expires_at<=now() then
   return jsonb_build_object('error','Code is invalid or expired. Ask your family for a new code.');
  end if;
  if (select count(*) from public.family_join_requests where code_id=target.id)>=20
   and not exists(select 1 from public.family_join_requests where code_id=target.id and user_id=caller) then
   return jsonb_build_object('error','Code is invalid or expired. Ask your family for a new code.');
  end if;
  insert into public.family_join_requests(code_id,user_id) values(target.id,caller) on conflict do nothing;
  select status into code from public.family_join_requests where code_id=target.id and user_id=caller;
  return jsonb_build_object('status',code);
 end if;
 if action='status' then
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'expired',c.revoked_at is not null or c.expires_at<=now())), '[]') into result
  from public.family_join_requests r join public.family_join_codes c on c.id=r.code_id where r.user_id=caller;
  return jsonb_build_object('requests',result);
 end if;
 home:=(payload->>'household_id')::uuid;
 if not exists(select 1 from public.households where id=home and created_by=caller)
  or not exists(select 1 from public.household_members where household_id=home and user_id=caller and role='owner') then
  raise exception 'Household owner access required';
 end if;
 -- Serialise creation, revocation and approvals for this household.
 perform 1 from public.households where id=home for update;
 if action='create' then
  update public.household_invitations set expires_at=now() where accepted_at is null and id in
   (select r.invitation_id from public.family_join_requests r join public.family_join_codes c on c.id=r.code_id where c.household_id=home);
  update public.family_join_codes set revoked_at=now() where household_id=home and revoked_at is null;
  code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.family_join_codes(household_id,created_by,code_hash) values(home,caller,encode(sha256(convert_to(code,'UTF8')),'hex')) returning * into target;
  return jsonb_build_object('id',target.id,'code',substr(code,1,5)||'-'||substr(code,6),'expires_at',target.expires_at);
 elsif action='load' then
  return jsonb_build_object('codes',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'expires_at',expires_at,'revoked',revoked_at is not null)),'[]') from public.family_join_codes where household_id=home and expires_at>now()),
   'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',p.display_name,'email',u.email,'status',r.status)),'[]') from public.family_join_requests r join public.family_join_codes c on c.id=r.code_id join public.profiles p on p.id=r.user_id join auth.users u on u.id=r.user_id where c.household_id=home and c.revoked_at is null and c.expires_at>now() and r.status='pending'));
 elsif action='revoke' then
  update public.household_invitations set expires_at=now() where accepted_at is null and id in
   (select r.invitation_id from public.family_join_requests r join public.family_join_codes c on c.id=r.code_id where c.id=(payload->>'id')::uuid and c.household_id=home);
  update public.family_join_codes set revoked_at=now() where id=(payload->>'id')::uuid and household_id=home;
  return jsonb_build_object('ok',true);
 elsif action in ('approve','decline') then
  select r.* into request_row from public.family_join_requests r join public.family_join_codes c on c.id=r.code_id
   where r.id=(payload->>'id')::uuid and c.household_id=home and c.revoked_at is null and c.expires_at>now() for update of r;
  if not found then raise exception 'Request is no longer available'; end if;
  if request_row.status<>'pending' then return jsonb_build_object('status',request_row.status); end if;
  if action='approve' then
   if exists(select 1 from public.household_members where user_id=request_row.user_id) then raise exception 'This person already belongs to a household'; end if;
   select email into request_email from auth.users where id=request_row.user_id and email_confirmed_at is not null;
   if request_email is null then raise exception 'Verified email required'; end if;
   if (select count(*) from public.household_members where household_id=home)>=5 then raise exception 'Core includes five household members'; end if;
   insert into public.household_invitations(household_id,email,invited_by,expires_at) values(home,lower(request_email),caller,now()+interval '7 days')
    on conflict(household_id,email) do update set invited_by=caller,accepted_at=null,expires_at=now()+interval '7 days' returning id into request_row.invitation_id;
  end if;
  update public.family_join_requests set invitation_id=request_row.invitation_id,status=case when action='approve' then 'approved' else 'declined' end where id=request_row.id;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown family join action';
end;
$$;
revoke all on function public.family_join(text,jsonb) from public,anon;
grant execute on function public.family_join(text,jsonb) to authenticated;
