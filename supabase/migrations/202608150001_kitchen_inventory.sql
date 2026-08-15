create table if not exists public.kitchen_inventory (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  quantity numeric(8,2) not null default 1 check (quantity >= 0),
  unit text not null default '',
  location text not null default 'fridge' check (location in ('fridge','freezer','pantry')),
  expires_on date,
  source_grocery_id uuid references public.grocery_items(id) on delete set null,
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kitchen_inventory_household_idx on public.kitchen_inventory(household_id, location, expires_on);
alter table public.kitchen_inventory enable row level security;
drop policy if exists "household kitchen inventory" on public.kitchen_inventory;
create policy "household kitchen inventory" on public.kitchen_inventory for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
drop trigger if exists kitchen_inventory_updated on public.kitchen_inventory;
create trigger kitchen_inventory_updated before update on public.kitchen_inventory for each row execute function public.set_updated_at();
alter table public.kitchen_inventory replica identity full;
do $$ begin alter publication supabase_realtime add table public.kitchen_inventory; exception when duplicate_object then null; end $$;
