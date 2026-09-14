alter table public.reminder_deliveries drop constraint reminder_deliveries_status_check;
alter table public.reminder_deliveries add constraint reminder_deliveries_status_check check(status in ('pending','processing','accepted','failed','skipped'));

create table public.household_feature_preferences (
 household_id uuid primary key references public.households(id) on delete cascade,
 features jsonb not null default '{}'::jsonb check(jsonb_typeof(features)='object'),
 pause_reminders boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.household_feature_preferences enable row level security;
create policy "members read feature preferences" on public.household_feature_preferences for select to authenticated
 using(public.is_household_member(household_id));
revoke all on public.household_feature_preferences from anon,authenticated;
grant select on public.household_feature_preferences to authenticated;
create function public.set_household_features(h uuid, selection jsonb, pause boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.household_members where household_id=h and user_id=auth.uid() and role='owner') then
  raise exception 'Only the household owner can customize FamOS';
 end if;
 if selection is null or jsonb_typeof(selection)<>'object' or exists(
  select 1 from jsonb_each(selection) e where e.key not in ('calendar','tasks','groceries','kitchen','meals','recipes','rewards','chat','fam_ai','insights','celebrations','routine_suggestions') or jsonb_typeof(e.value)<>'boolean'
 ) then raise exception 'Invalid feature selection'; end if;
 insert into public.household_feature_preferences(household_id,features,pause_reminders) values(h,selection,coalesce(pause,false))
 on conflict(household_id) do update set features=excluded.features,pause_reminders=excluded.pause_reminders,updated_at=now();
end;
$$;
revoke all on function public.set_household_features(uuid,jsonb,boolean) from public,anon;
grant execute on function public.set_household_features(uuid,jsonb,boolean) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.household_feature_preferences;
 end if;
end $$;
