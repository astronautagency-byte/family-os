-- Multiple calendars and Reminders-style task lists.
create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#6d4de8',
  created_by uuid not null references public.profiles(id),
  visibility text not null default 'household' check (visibility in ('household','selected','private','guardian_only')),
  selected_member_ids uuid[] not null default '{}'::uuid[],
  is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.task_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#6d4de8', icon text not null default 'list',
  created_by uuid not null references public.profiles(id),
  visibility text not null default 'household' check (visibility in ('household','selected','private','guardian_only')),
  selected_member_ids uuid[] not null default '{}'::uuid[],
  is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.events add column if not exists calendar_id uuid references public.calendars(id) on delete set null;
alter table public.tasks add column if not exists list_id uuid references public.task_lists(id) on delete set null;
alter table public.calendars enable row level security;
alter table public.task_lists enable row level security;
create policy "permission aware calendars" on public.calendars for select to authenticated using
  (public.can_view_coordination_item(household_id,created_by,visibility,selected_member_ids));
create policy "members create calendars" on public.calendars for insert to authenticated with check
  (public.is_household_member(household_id) and created_by=auth.uid());
create policy "calendar creators update" on public.calendars for update to authenticated using (created_by=auth.uid());
create policy "calendar creators delete" on public.calendars for delete to authenticated using (created_by=auth.uid());
create policy "permission aware task lists" on public.task_lists for select to authenticated using
  (public.can_view_coordination_item(household_id,created_by,visibility,selected_member_ids));
create policy "members create task lists" on public.task_lists for insert to authenticated with check
  (public.is_household_member(household_id) and created_by=auth.uid());
create policy "task list creators update" on public.task_lists for update to authenticated using (created_by=auth.uid());
create policy "task list creators delete" on public.task_lists for delete to authenticated using (created_by=auth.uid());
create index if not exists calendars_household_idx on public.calendars(household_id);
create index if not exists task_lists_household_idx on public.task_lists(household_id);
