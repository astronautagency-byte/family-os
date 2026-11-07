begin;
-- Guest helpers receive scoped sessions, never household membership or a Supabase user.
create table public.helper_passcodes(
 access_id uuid primary key references public.household_helper_access(id) on delete cascade,
 salt text not null, code_hash text not null, phone text,
 sms_consent_at timestamptz,
 failed_attempts integer not null default 0, locked_until timestamptz
);
create table public.helper_guest_sessions(
 secret_hash text primary key, access_id uuid not null references public.household_helper_access(id) on delete cascade,
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table public.helper_invitation_deliveries(
 id uuid primary key default gen_random_uuid(),access_id uuid not null references public.household_helper_access(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),
 status text not null default 'attempted' check(status in ('attempted','accepted','failed'))
);
create index helper_delivery_actor_time on public.helper_invitation_deliveries(actor_id,created_at);
alter table public.helper_passcodes enable row level security;
alter table public.helper_guest_sessions enable row level security;
alter table public.helper_invitation_deliveries enable row level security;
revoke all on public.helper_passcodes,public.helper_guest_sessions,public.helper_invitation_deliveries from public,anon,authenticated;
grant all on public.helper_passcodes,public.helper_guest_sessions,public.helper_invitation_deliveries to service_role;
create function public.invite_helper_passcode(action text,h uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; salt text:=gen_random_uuid()::text; code text:=payload->>'passcode'; phone text:=nullif(payload->>'phone','');
begin
 if action<>'invite' or auth.uid() is null or not exists(select 1 from public.households where id=h and created_by=auth.uid()) then raise exception 'Family owner access required'; end if;
 if length(code) not between 8 and 64 or code is null then raise exception 'Choose a passcode of 8 to 64 characters'; end if;
 if phone is not null and (phone !~ '^\+[1-9][0-9]{7,14}$' or payload->>'sms_consent' is distinct from 'true') then raise exception 'Enter a phone number with country code and confirm permission to send the invitation'; end if;
 result:=public.family_helpers('invite',h,(payload-'passcode'-'phone'-'sms_consent')||jsonb_build_object('email','helper-'||gen_random_uuid()::text||'@passcode.invalid'));
 insert into public.helper_passcodes(access_id,salt,code_hash,phone,sms_consent_at) values((result->>'id')::uuid,salt,encode(sha256(convert_to(salt||code,'UTF8')),'hex'),phone,case when phone is not null then now() end);
 return result||jsonb_build_object('mode','passcode');
end $$;
revoke all on function public.invite_helper_passcode(text,uuid,jsonb) from public,anon;
grant execute on function public.invite_helper_passcode(text,uuid,jsonb) to authenticated;
create function public.helper_guest_login(token text,passcode text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.household_helper_access; c public.helper_passcodes; secret text; expiry timestamptz;
begin
 select * into a from public.household_helper_access where invite_hash=encode(sha256(convert_to(coalesce(token,''),'UTF8')),'hex') for update;
 if a.id is null or a.state not in ('pending','active') or a.expires_at<=now() or (a.state='pending' and a.invite_expires_at<=now()) then return jsonb_build_object('error','Access unavailable. Ask the family for a new invitation.'); end if;
 select * into c from public.helper_passcodes where access_id=a.id for update;
 if c.access_id is null then return jsonb_build_object('error','Access unavailable'); end if;
 if c.locked_until>now() then return jsonb_build_object('error','Too many attempts. Try again in 15 minutes or ask the family for a new invitation.'); end if;
 if length(coalesce(passcode,''))>64 or c.code_hash<>encode(sha256(convert_to(c.salt||coalesce(passcode,''),'UTF8')),'hex') then
  update public.helper_passcodes set failed_attempts=case when locked_until is not null then 1 else failed_attempts+1 end,locked_until=case when (case when locked_until is not null then 1 else failed_attempts+1 end)>=5 then now()+interval '15 minutes' else null end where access_id=a.id;
  return jsonb_build_object('error','Passcode not recognised. Check with the family.');
 end if;
 update public.helper_passcodes set failed_attempts=0,locked_until=null where access_id=a.id;
 update public.household_helper_access set state='active',accepted_at=coalesce(accepted_at,now()) where id=a.id;
 delete from public.helper_guest_sessions where access_id=a.id and expires_at<=now();
 secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');expiry:=least(a.expires_at,now()+interval '12 hours');
 insert into public.helper_guest_sessions(secret_hash,access_id,expires_at) values(encode(sha256(convert_to(secret,'UTF8')),'hex'),a.id,expiry);
 insert into public.helper_access_audit(household_id,access_id,action) values(a.household_id,a.id,'passcode_session_started');
 return jsonb_build_object('secret',secret,'expires_at',expiry);
end $$;
create function public.helper_guest_portal(secret text,action text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.household_helper_access; g public.helper_resource_grants; changed integer; target uuid;
begin
 select x.* into a from public.household_helper_access x join public.helper_guest_sessions s on s.access_id=x.id
 where s.secret_hash=encode(sha256(convert_to(coalesce(secret,''),'UTF8')),'hex') and s.expires_at>now() and x.state='active' and x.expires_at>now() for update of x;
 if a.id is null then return jsonb_build_object('error','Access ended or is unavailable.'); end if;
 if action='logout' then delete from public.helper_guest_sessions where secret_hash=encode(sha256(convert_to(secret,'UTF8')),'hex');return '{}'::jsonb; end if;
 if action='read' then return jsonb_build_object('family',(select name from public.households where id=a.household_id),'expires_at',a.expires_at,'resources',public.helper_shared_resources(a.id)); end if;
 if action<>'complete' then raise exception 'Action unavailable'; end if;
 if jsonb_typeof(payload->'done') is distinct from 'boolean' then raise exception 'Completion must be true or false'; end if;
 select * into g from public.helper_resource_grants where id=(payload->>'grant_id')::uuid and access_id=a.id and permission='complete';
 if g.id is null then raise exception 'Completion not permitted'; end if;target:=(payload->>'item_id')::uuid;
 if g.task_list_id is not null then
  update public.tasks i set is_done=(payload->>'done')::boolean where i.id=target and i.household_id=a.household_id and i.list_id=g.task_list_id and i.visibility='household' and exists(select 1 from public.task_lists l where l.id=g.task_list_id and l.household_id=a.household_id and l.visibility='household');
 elsif g.grocery_list_id is not null then
  update public.grocery_items i set is_checked=(payload->>'done')::boolean where i.id=target and i.household_id=a.household_id and i.list_id=g.grocery_list_id;
 elsif g.shared_list_id is not null then
  update public.shared_list_items i set status=case when (payload->>'done')::boolean then 'completed' else 'open' end where i.id=target and i.list_id=g.shared_list_id and exists(select 1 from public.shared_lists l where l.id=g.shared_list_id and l.household_id=a.household_id and l.visibility='household');
 else raise exception 'Completion not permitted';end if;
 get diagnostics changed=row_count;if changed<>1 then raise exception 'Item unavailable';end if;
 insert into public.helper_access_audit(household_id,access_id,action,resource_id) values(a.household_id,a.id,case when (payload->>'done')::boolean then 'helper_checked_off' else 'helper_reopened' end,target);
 return '{}'::jsonb;
end $$;
create function public.claim_helper_sms(access_id uuid,actor uuid,token text,passcode text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.household_helper_access;c public.helper_passcodes;result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select x.* into a from public.household_helper_access x join public.households h on h.id=x.household_id where x.id=access_id and h.created_by=actor and x.state in ('pending','active') and x.expires_at>now() for update of x;
 select * into c from public.helper_passcodes where helper_passcodes.access_id=a.id;
 if a.id is null or c.phone is null or c.sms_consent_at is null or a.invite_hash<>encode(sha256(convert_to(coalesce(token,''),'UTF8')),'hex') or c.code_hash<>encode(sha256(convert_to(c.salt||coalesce(passcode,''),'UTF8')),'hex') then raise exception 'Invitation unavailable';end if;
 if exists(select 1 from public.helper_invitation_deliveries d where d.access_id=a.id and (d.status='accepted' or d.created_at>now()-interval '1 minute')) then raise exception 'Invitation already sent or recently attempted';end if;
 if (select count(*) from public.helper_invitation_deliveries where actor_id=actor and created_at>now()-interval '1 hour')>=10 then raise exception 'Invitation SMS limit reached. Try later.';end if;
 insert into public.helper_invitation_deliveries(access_id,actor_id) values(a.id,actor) returning id into result;
 return jsonb_build_object('id',result,'phone',c.phone);
end $$;
revoke all on function public.helper_guest_login(text,text),public.helper_guest_portal(text,text,jsonb),public.claim_helper_sms(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.helper_guest_login(text,text),public.helper_guest_portal(text,text,jsonb),public.claim_helper_sms(uuid,uuid,text,text) to service_role;

commit;
