-- Revised onboarding setup data. These fields are optional so existing households
-- and older clients continue to work without a backfill.
alter table public.household_profiles
  add column if not exists onboarding_family jsonb not null default '[]'::jsonb,
  add column if not exists onboarding_interests text[] not null default '{}',
  add column if not exists onboarding_schedule_sources text[] not null default '{}',
  add column if not exists schedule_feed_url text not null default '';

notify pgrst, 'reload schema';
