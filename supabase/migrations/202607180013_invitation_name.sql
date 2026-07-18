alter table public.household_invitations
  add column if not exists invited_name text;

comment on column public.household_invitations.invited_name is
  'Name supplied by the household member who created the invitation.';
