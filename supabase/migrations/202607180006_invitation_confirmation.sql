-- Matching accounts must explicitly accept an invitation. This function remains
-- available for the owner-side "Check" action, but it no longer creates memberships.
revoke execute on function public.accept_matching_household_invitation() from public, authenticated;

create or replace function public.reconcile_existing_household_invitations(target_household uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare matching_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = auth.uid() and role = 'owner'
  ) then raise exception 'Only household owners can check invitations'; end if;

  select count(*) into matching_count
  from public.household_invitations invitation
  join public.profiles profile on lower(profile.email) = lower(invitation.email)
  where invitation.household_id = target_household
    and invitation.accepted_at is null
    and invitation.expires_at > now();
  return matching_count;
end;
$$;

grant execute on function public.reconcile_existing_household_invitations(uuid) to authenticated;
notify pgrst, 'reload schema';
