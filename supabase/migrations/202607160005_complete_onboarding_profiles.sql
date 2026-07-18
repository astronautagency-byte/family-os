-- Finish onboarding persistence so household and member preferences survive
-- across browsers and devices.

alter table public.household_profiles
  add column if not exists profile_type text not null default 'parent',
  add column if not exists dietary_restrictions text[] not null default '{}',
  add column if not exists avoid_ingredients text not null default '',
  add column if not exists meal_notes text not null default '';

create table if not exists public.household_member_profiles (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  profile_type text not null default 'parent',
  calendar_preference text not null default 'family',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

drop trigger if exists household_member_profiles_updated on public.household_member_profiles;
create trigger household_member_profiles_updated
before update on public.household_member_profiles
for each row execute function public.set_updated_at();

alter table public.household_member_profiles enable row level security;

create policy "members view household member profiles"
on public.household_member_profiles for select to authenticated
using (public.is_household_member(household_id));

create policy "members manage their onboarding profile"
on public.household_member_profiles for all to authenticated
using (
  user_id = auth.uid()
  and public.is_household_member(household_id)
)
with check (
  user_id = auth.uid()
  and public.is_household_member(household_id)
);
