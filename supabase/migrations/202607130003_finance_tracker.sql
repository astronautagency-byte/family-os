create table if not exists public.household_finance_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  weekly_budget numeric(12,2) not null default 0 check (weekly_budget >= 0),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  amount numeric(12,2) not null check (amount > 0),
  category text not null default 'Other',
  spent_on date not null default current_date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_household_date_idx on public.expenses(household_id, spent_on desc);

drop trigger if exists finance_settings_updated on public.household_finance_settings;
create trigger finance_settings_updated before update on public.household_finance_settings for each row execute function public.set_updated_at();
drop trigger if exists expenses_updated on public.expenses;
create trigger expenses_updated before update on public.expenses for each row execute function public.set_updated_at();

alter table public.household_finance_settings enable row level security;
alter table public.expenses enable row level security;

create policy "household finance settings" on public.household_finance_settings for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

create policy "household expenses" on public.expenses for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

alter publication supabase_realtime add table public.household_finance_settings, public.expenses;
