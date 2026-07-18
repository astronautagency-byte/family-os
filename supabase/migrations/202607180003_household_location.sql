alter table public.household_profiles
  add column if not exists city text not null default '',
  add column if not exists country text not null default '';

notify pgrst, 'reload schema';
