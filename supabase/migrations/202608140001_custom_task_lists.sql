-- Household-owned custom task lists. Existing task categories continue to work unchanged.
create table if not exists public.task_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#6b5ce7',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.tasks add column if not exists list_id uuid references public.task_lists(id) on delete set null;
alter table public.task_lists enable row level security;

create policy "household members read task lists" on public.task_lists for select to authenticated
  using (public.is_household_member(household_id));
create policy "household members create task lists" on public.task_lists for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy "task list creators update" on public.task_lists for update to authenticated
  using (created_by = auth.uid()) with check (public.is_household_member(household_id));
create policy "task list creators delete" on public.task_lists for delete to authenticated
  using (created_by = auth.uid());

create index if not exists task_lists_household_idx on public.task_lists(household_id, created_at);
create index if not exists tasks_list_idx on public.tasks(list_id);
