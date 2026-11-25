create table public.mia_live_sessions (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 started_at timestamptz not null default now(),
 expires_at timestamptz not null,
 text_requests integer not null default 0,
 ended_at timestamptz
);
alter table public.mia_live_sessions enable row level security;
revoke all on public.mia_live_sessions from public,anon,authenticated;
create index mia_live_sessions_budget on public.mia_live_sessions(household_id,started_at);
create function public.reserve_mia_live_session(target_user uuid,target_household uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare spent integer; seconds_left integer; session_id uuid;
begin
 if not exists(select 1 from public.household_members where user_id=target_user and household_id=target_household) then raise exception 'Household access required'; end if;
 perform 1 from public.households where id=target_household for update;
 if exists(select 1 from public.mia_live_sessions where household_id=target_household and ended_at is null and expires_at>now()) then
  return jsonb_build_object('error','A live conversation is already active in this household.');
 end if;
 select coalesce(sum(ceil(extract(epoch from greatest(interval '0',least(coalesce(ended_at,expires_at),expires_at)-started_at)))),0)::integer
 into spent from public.mia_live_sessions where household_id=target_household and started_at>=date_trunc('month',now());
 if (select count(*) from public.mia_live_sessions where household_id=target_household and started_at>=date_trunc('month',now()))>=30 then return jsonb_build_object('error','Live voice preview connection limit reached. You can type instead.'); end if;
 seconds_left:=least(180,180-spent);
 if seconds_left<5 then return jsonb_build_object('error','Your household’s 3-minute monthly live voice preview is used. You can still type your request.'); end if;
 insert into public.mia_live_sessions(household_id,user_id,expires_at) values(target_household,target_user,now()+make_interval(secs=>seconds_left)) returning id into session_id;
 return jsonb_build_object('id',session_id,'seconds',seconds_left);
end;
$$;
revoke all on function public.reserve_mia_live_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_mia_live_session(uuid,uuid) to service_role;

create function public.consume_mia_live_text(target_session uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare home uuid;
begin
 select household_id into home from public.mia_live_sessions where id=target_session and ended_at is null and expires_at>now();
 if home is null then return false; end if;
 perform 1 from public.households where id=home for update;
 if (select coalesce(sum(text_requests),0) from public.mia_live_sessions where household_id=home and started_at>=date_trunc('month',now()))>=12 then return false; end if;
 update public.mia_live_sessions set text_requests=text_requests+1 where id=target_session;
 return true;
end;
$$;
revoke all on function public.consume_mia_live_text(uuid) from public,anon,authenticated;
grant execute on function public.consume_mia_live_text(uuid) to service_role;

create table public.mia_live_privacy_choices (
 user_id uuid primary key references auth.users(id) on delete cascade,
 accepted_at timestamptz not null default now(),
 withdrawn_at timestamptz
);
alter table public.mia_live_privacy_choices enable row level security;
revoke all on public.mia_live_privacy_choices from public,anon,authenticated;
create function public.mia_live_privacy(action text default 'status',streaming_confirmed boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare base jsonb; accepted boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 base:=public.ai_privacy_choices('status');
 if action='accept' then
  if not coalesce((base->>'accepted')::boolean,false) or not streaming_confirmed then raise exception 'Adult AI permission and live audio consent required'; end if;
  insert into public.mia_live_privacy_choices(user_id) values(auth.uid()) on conflict(user_id) do update set accepted_at=now(),withdrawn_at=null;
 elsif action='withdraw' then
  update public.mia_live_privacy_choices set withdrawn_at=now() where user_id=auth.uid();
 elsif action<>'status' then raise exception 'Unknown live privacy action'; end if;
 select exists(select 1 from public.mia_live_privacy_choices where user_id=auth.uid() and withdrawn_at is null) into accepted;
 return jsonb_build_object('accepted',accepted and coalesce((base->>'accepted')::boolean,false),'version','2026-11-24-live');
end;
$$;
revoke all on function public.mia_live_privacy(text,boolean) from public,anon;
grant execute on function public.mia_live_privacy(text,boolean) to authenticated;
