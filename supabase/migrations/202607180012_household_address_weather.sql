alter table public.household_profiles
  add column if not exists address text not null default '',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

