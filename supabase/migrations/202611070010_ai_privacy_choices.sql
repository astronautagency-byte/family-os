begin;
-- Optional AI processing: versioned per-user opt-in, withdrawal and fail-closed age checks.
create table if not exists public.ai_privacy_choices (
 user_id uuid not null references auth.users(id) on delete cascade,
 policy_version text not null,
 adult_attested_at timestamptz not null,
 accepted_at timestamptz not null,
 withdrawn_at timestamptz,
 primary key(user_id,policy_version)
);
alter table public.ai_privacy_choices enable row level security;
revoke all on public.ai_privacy_choices from anon, authenticated;
grant select on public.ai_privacy_choices to authenticated;
drop policy if exists "read own AI privacy choices" on public.ai_privacy_choices;
create policy "read own AI privacy choices" on public.ai_privacy_choices for select to authenticated using(user_id=auth.uid());
create or replace function public.ai_privacy_choices(action text default 'status', adult_confirmed boolean default false, processing_confirmed boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); h uuid; member_role text; p_type text; p_age int; dob date; eligible boolean:=false; accepted boolean:=false; v constant text:='2026-11-07';
begin
 if u is null then raise exception 'Sign in required';end if;
 select household_id,role into h,member_role from public.household_members where user_id=u limit 1;
 if h is not null then
  select profile_type,age,date_of_birth into p_type,p_age,dob from public.household_member_profiles where household_id=h and user_id=u;
  eligible:=lower(coalesce(member_role,'')) not in ('child','kid','teen','minor')
   and lower(coalesce(p_type,'')) not in ('child','kid','teen','minor')
   and (p_age is null or p_age>=18)
   and (dob is null or dob <= (current_date - interval '18 years')::date);
 end if;
 if action='accept' then
  if not eligible or adult_confirmed is not true or processing_confirmed is not true then raise exception 'AI is available only to adults who choose to enable AI processing';end if;
  insert into public.ai_privacy_choices values(u,v,now(),now(),null)
   on conflict(user_id,policy_version) do update set adult_attested_at=now(),accepted_at=now(),withdrawn_at=null;
 elsif action='withdraw' then
  update public.ai_privacy_choices set withdrawn_at=now() where user_id=u and policy_version=v and withdrawn_at is null;
 elsif action<>'status' then raise exception 'Unknown privacy action';end if;
 select exists(select 1 from public.ai_privacy_choices where user_id=u and policy_version=v and withdrawn_at is null) into accepted;
 return jsonb_build_object('eligible',eligible,'accepted',eligible and accepted,'version',v);
end $$;
revoke all on function public.ai_privacy_choices(text,boolean,boolean) from public,anon;
grant execute on function public.ai_privacy_choices(text,boolean,boolean) to authenticated;

commit;
