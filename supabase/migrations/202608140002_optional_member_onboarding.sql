-- Optional personal onboarding for each household member.
alter table public.household_member_profiles
  add column if not exists age integer check (age is null or (age >= 0 and age <= 120)),
  add column if not exists date_of_birth date,
  add column if not exists dietary_restrictions text[] not null default '{}';

-- Existing members must enter the app immediately. Only memberships created
-- after this migration will lack a completed personal profile and see the
-- optional first-time personalization flow.
insert into public.household_member_profiles (
  household_id, user_id, profile_type, calendar_preference, completed_at
)
select hm.household_id, hm.user_id,
  case when hm.role = 'owner' then 'parent' else 'parent' end,
  'family', now()
from public.household_members hm
on conflict (household_id, user_id) do update
set completed_at = coalesce(public.household_member_profiles.completed_at, excluded.completed_at);
