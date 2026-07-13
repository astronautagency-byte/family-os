create table public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  meal_date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  title text not null default '',
  notes text not null default '',
  cook_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, meal_date, slot)
);

create index meals_household_date_idx on public.meals(household_id, meal_date);
create trigger meals_updated before update on public.meals for each row execute function public.set_updated_at();
alter table public.meals enable row level security;
create policy "household meals" on public.meals for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
alter publication supabase_realtime add table public.meals;
