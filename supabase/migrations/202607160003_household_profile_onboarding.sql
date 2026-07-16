-- Household onboarding profile for personalization and future opt-in partner integrations.

create table if not exists public.household_profiles (
  household_id uuid primary key references public.households(id) on delete cascade,
  family_size integer not null default 1 check (family_size between 1 and 30),
  adult_count integer not null default 1 check (adult_count between 0 and 30),
  child_count integer not null default 0 check (child_count between 0 and 30),
  family_dynamic text not null default '',
  life_stage text not null default '',
  planning_priorities text[] not null default '{}',
  primary_color text not null default 'purple',
  partner_personalization_opt_in boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger household_profiles_updated
before update on public.household_profiles
for each row execute function public.set_updated_at();

alter table public.household_profiles enable row level security;

create policy "members view household profile"
on public.household_profiles for select to authenticated
using (public.is_household_member(household_id));

create policy "owners manage household profile"
on public.household_profiles for all to authenticated
using (
  exists (
    select 1 from public.household_members
    where household_id = household_profiles.household_id
      and user_id = auth.uid()
      and role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.household_members
    where household_id = household_profiles.household_id
      and user_id = auth.uid()
      and role = 'owner'
  )
);
