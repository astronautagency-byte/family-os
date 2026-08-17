-- FamOS privacy-first coordination MVP.
-- Safe to apply after the existing migrations. Existing rows remain household-visible.

alter table public.household_members
  add column if not exists coordination_role text not null default 'adult_member',
  add column if not exists age_group text not null default 'adult',
  add column if not exists member_color text not null default 'plum',
  add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table public.tasks
  add column if not exists description text not null default '',
  add column if not exists status text not null default 'assigned',
  add column if not exists priority text not null default 'normal',
  add column if not exists visibility text not null default 'household',
  add column if not exists selected_member_ids uuid[] not null default '{}'::uuid[];

alter table public.events
  add column if not exists description text not null default '',
  add column if not exists visibility text not null default 'household',
  add column if not exists selected_member_ids uuid[] not null default '{}'::uuid[];

do $$ begin
  alter table public.tasks add constraint tasks_visibility_check
    check (visibility in ('household','selected','private','guardian_only'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.events add constraint events_visibility_check
    check (visibility in ('household','selected','private','guardian_only'));
exception when duplicate_object then null; end $$;

create or replace function public.can_view_coordination_item(
  target_household uuid,
  item_creator uuid,
  item_visibility text,
  selected_users uuid[] default '{}'::uuid[]
) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and public.is_household_member(target_household)
    and (
      item_creator = auth.uid()
      or item_visibility = 'household'
      or (item_visibility = 'selected' and auth.uid() = any(selected_users))
      or (item_visibility = 'guardian_only' and exists (
        select 1 from public.household_members hm
        where hm.household_id = target_household
          and hm.user_id = auth.uid()
          and (hm.role = 'owner' or hm.coordination_role in ('household_owner','adult_admin'))
      ))
    );
$$;

grant execute on function public.can_view_coordination_item(uuid,uuid,text,uuid[]) to authenticated;

drop policy if exists "household tasks" on public.tasks;
create policy "permission aware task reads" on public.tasks for select to authenticated
  using (public.can_view_coordination_item(household_id, created_by, visibility, selected_member_ids));
create policy "members create scoped tasks" on public.tasks for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy "task owners and assignees update" on public.tasks for update to authenticated
  using (created_by = auth.uid() or assignee_id = auth.uid())
  with check (public.is_household_member(household_id));
create policy "task creators delete" on public.tasks for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "household events" on public.events;
create policy "permission aware event reads" on public.events for select to authenticated
  using (public.can_view_coordination_item(household_id, created_by, visibility, selected_member_ids));
create policy "members create scoped events" on public.events for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy "event creators update" on public.events for update to authenticated
  using (created_by = auth.uid()) with check (public.is_household_member(household_id));
create policy "event creators delete" on public.events for delete to authenticated
  using (created_by = auth.uid());

create table if not exists public.family_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  requester_id uuid not null references public.profiles(id),
  responder_id uuid references public.profiles(id),
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  deadline timestamptz,
  status text not null default 'open' check (status in ('open','accepted','declined','completed')),
  visibility text not null default 'household' check (visibility in ('household','selected','private','guardian_only')),
  selected_member_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.shared_lists (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  title text not null, list_type text not null default 'custom', created_by uuid not null references public.profiles(id),
  visibility text not null default 'household' check (visibility in ('household','selected','private','guardian_only')),
  selected_member_ids uuid[] not null default '{}'::uuid[], created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.shared_list_items (
  id uuid primary key default gen_random_uuid(), list_id uuid not null references public.shared_lists(id) on delete cascade,
  title text not null, quantity numeric(8,2) not null default 1, note text not null default '', assignee_id uuid references public.profiles(id),
  status text not null default 'open' check (status in ('open','completed')), due_at timestamptz, sequence integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  title text not null, recurrence_rule text not null default '', created_by uuid not null references public.profiles(id),
  steps jsonb not null default '[]'::jsonb, visibility text not null default 'household' check (visibility in ('household','selected','private','guardian_only')),
  selected_member_ids uuid[] not null default '{}'::uuid[], created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  actor_id uuid not null references public.profiles(id), action_type text not null, entity_type text not null, entity_id uuid,
  summary text not null, visibility text not null default 'household', selected_member_ids uuid[] not null default '{}'::uuid[], created_at timestamptz not null default now()
);

alter table public.family_requests enable row level security;
alter table public.shared_lists enable row level security;
alter table public.shared_list_items enable row level security;
alter table public.routines enable row level security;
alter table public.activity_log enable row level security;

create policy "permission aware requests" on public.family_requests for select to authenticated using
  (public.can_view_coordination_item(household_id, requester_id, visibility, selected_member_ids) or responder_id = auth.uid());
create policy "members create requests" on public.family_requests for insert to authenticated with check
  (public.is_household_member(household_id) and requester_id = auth.uid());
create policy "request participants update" on public.family_requests for update to authenticated using
  (requester_id = auth.uid() or responder_id = auth.uid());
create policy "requesters delete" on public.family_requests for delete to authenticated using (requester_id = auth.uid());

create policy "permission aware lists" on public.shared_lists for select to authenticated using
  (public.can_view_coordination_item(household_id, created_by, visibility, selected_member_ids));
create policy "members create lists" on public.shared_lists for insert to authenticated with check
  (public.is_household_member(household_id) and created_by = auth.uid());
create policy "list creators write" on public.shared_lists for all to authenticated using (created_by = auth.uid()) with check (public.is_household_member(household_id));
create policy "visible list items" on public.shared_list_items for select to authenticated using
  (exists (select 1 from public.shared_lists l where l.id = list_id and public.can_view_coordination_item(l.household_id,l.created_by,l.visibility,l.selected_member_ids)));
create policy "visible members write list items" on public.shared_list_items for all to authenticated using
  (exists (select 1 from public.shared_lists l where l.id = list_id and public.can_view_coordination_item(l.household_id,l.created_by,l.visibility,l.selected_member_ids)))
  with check (exists (select 1 from public.shared_lists l where l.id = list_id and public.can_view_coordination_item(l.household_id,l.created_by,l.visibility,l.selected_member_ids)));

create policy "permission aware routines" on public.routines for select to authenticated using
  (public.can_view_coordination_item(household_id, created_by, visibility, selected_member_ids));
create policy "members create routines" on public.routines for insert to authenticated with check
  (public.is_household_member(household_id) and created_by = auth.uid());
create policy "routine creators write" on public.routines for update to authenticated using (created_by = auth.uid());
create policy "routine creators delete" on public.routines for delete to authenticated using (created_by = auth.uid());

create policy "permission aware activity" on public.activity_log for select to authenticated using
  (public.can_view_coordination_item(household_id, actor_id, visibility, selected_member_ids));
create policy "members create own activity" on public.activity_log for insert to authenticated with check
  (public.is_household_member(household_id) and actor_id = auth.uid());

create index if not exists family_requests_household_deadline_idx on public.family_requests(household_id, deadline);
create index if not exists shared_lists_household_idx on public.shared_lists(household_id);
create index if not exists routines_household_idx on public.routines(household_id);
create index if not exists activity_log_household_created_idx on public.activity_log(household_id, created_at desc);
