-- Active-family operations: activities, readiness, transport, and reusable gear.
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null, activity_type text not null default 'custom', participant_ids uuid[] not null default '{}'::uuid[],
  organization text not null default '', contact_name text not null default '', contact_details text not null default '',
  default_location text not null default '', arrival_minutes integer not null default 15,
  primary_driver_id uuid references public.profiles(id), backup_driver_id uuid references public.profiles(id),
  weather_sensitive boolean not null default false, color text not null default '#6d4de8', notes text not null default '',
  visibility text not null default 'household' check (visibility in ('household','selected','private','guardian_only')),
  selected_member_ids uuid[] not null default '{}'::uuid[], created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.gear_kits (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete cascade, title text not null,
  items jsonb not null default '[]'::jsonb, created_by uuid not null references public.profiles(id),
  visibility text not null default 'household', selected_member_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.transportation_assignments (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade, activity_id uuid references public.activities(id) on delete set null,
  driver_id uuid references public.profiles(id), passenger_ids uuid[] not null default '{}'::uuid[], backup_driver_id uuid references public.profiles(id),
  pickup_location text not null default '', destination text not null default '', pickup_at timestamptz, leave_at timestamptz,
  status text not null default 'unassigned' check (status in ('unassigned','requested','accepted','declined','completed','cancelled')),
  created_by uuid not null references public.profiles(id), visibility text not null default 'household', selected_member_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.events
  add column if not exists activity_id uuid references public.activities(id) on delete set null,
  add column if not exists readiness jsonb not null default '{}'::jsonb,
  add column if not exists change_note text not null default '';
alter table public.activities enable row level security;
alter table public.gear_kits enable row level security;
alter table public.transportation_assignments enable row level security;
create policy "permission aware activities" on public.activities for select to authenticated using
  (public.can_view_coordination_item(household_id,created_by,visibility,selected_member_ids));
create policy "members create activities" on public.activities for insert to authenticated with check
  (public.is_household_member(household_id) and created_by=auth.uid());
create policy "activity creators write" on public.activities for update to authenticated using (created_by=auth.uid());
create policy "activity creators delete" on public.activities for delete to authenticated using (created_by=auth.uid());
create policy "permission aware gear" on public.gear_kits for select to authenticated using
  (public.can_view_coordination_item(household_id,created_by,visibility,selected_member_ids));
create policy "members create gear" on public.gear_kits for insert to authenticated with check
  (public.is_household_member(household_id) and created_by=auth.uid());
create policy "gear creators write" on public.gear_kits for all to authenticated using (created_by=auth.uid()) with check (public.is_household_member(household_id));
create policy "permission aware transportation" on public.transportation_assignments for select to authenticated using
  (public.can_view_coordination_item(household_id,created_by,visibility,selected_member_ids) or driver_id=auth.uid() or auth.uid()=any(passenger_ids));
create policy "members create transportation" on public.transportation_assignments for insert to authenticated with check
  (public.is_household_member(household_id) and created_by=auth.uid());
create policy "transport participants update" on public.transportation_assignments for update to authenticated using
  (created_by=auth.uid() or driver_id=auth.uid() or backup_driver_id=auth.uid());
create policy "transport creators delete" on public.transportation_assignments for delete to authenticated using (created_by=auth.uid());
create index if not exists activities_household_idx on public.activities(household_id);
create index if not exists transport_household_leave_idx on public.transportation_assignments(household_id,leave_at);
