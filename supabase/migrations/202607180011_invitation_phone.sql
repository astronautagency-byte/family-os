alter table public.household_invitations
  add column if not exists phone text;

create index if not exists household_invitations_phone_idx
  on public.household_invitations(phone)
  where phone is not null and accepted_at is null;

notify pgrst, 'reload schema';
