-- Reliable custom task assignment, task instructions, and household shopping lists.
alter table public.tasks add column if not exists notes text not null default '' check (char_length(notes) <= 4000);

create table if not exists public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#3b8c75',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

alter table public.grocery_items add column if not exists list_id uuid references public.grocery_lists(id) on delete set null;
alter table public.grocery_lists enable row level security;

create policy "household members read grocery lists" on public.grocery_lists for select to authenticated
  using (public.is_household_member(household_id));
create policy "household members create grocery lists" on public.grocery_lists for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy "household members update grocery lists" on public.grocery_lists for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy "household members delete grocery lists" on public.grocery_lists for delete to authenticated
  using (public.is_household_member(household_id));

create index if not exists grocery_lists_household_idx on public.grocery_lists(household_id, created_at);
create index if not exists grocery_items_list_idx on public.grocery_items(list_id);

alter publication supabase_realtime add table public.grocery_lists;
