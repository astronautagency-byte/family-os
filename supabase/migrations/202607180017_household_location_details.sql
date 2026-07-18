alter table public.household_profiles
  add column if not exists region text not null default '',
  add column if not exists postal_code text not null default '';

notify pgrst, 'reload schema';
