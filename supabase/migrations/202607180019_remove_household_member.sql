create or replace function public.remove_household_member(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household uuid;
  target_creator uuid;
  target_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_user is null then raise exception 'A family member is required'; end if;

  select membership.household_id, household.created_by
  into target_household, target_creator
  from public.household_members membership
  join public.households household on household.id = membership.household_id
  where membership.user_id = auth.uid()
  limit 1;

  if target_household is null or target_creator <> auth.uid() then
    raise exception 'Only the master owner can remove family members';
  end if;
  if target_user = auth.uid() then
    raise exception 'The master owner cannot remove themselves';
  end if;
  if not exists (
    select 1 from public.household_members
    where household_id = target_household and user_id = target_user
  ) then
    raise exception 'That person is not a member of this household';
  end if;

  select email into target_email from public.profiles where id = target_user;

  -- Older FamOS databases may not have the extended onboarding profile table
  -- yet, so clean it up when present without making member removal depend on it.
  if to_regclass('public.household_member_profiles') is not null then
    execute 'delete from public.household_member_profiles where household_id = $1 and user_id = $2'
      using target_household, target_user;
  end if;

  delete from public.household_members
  where household_id = target_household and user_id = target_user;

  if target_email is not null then
    delete from public.household_invitations
    where household_id = target_household and lower(email) = lower(target_email);
  end if;
end;
$$;

revoke all on function public.remove_household_member(uuid) from public, anon;
grant execute on function public.remove_household_member(uuid) to authenticated;

notify pgrst, 'reload schema';
