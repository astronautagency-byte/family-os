-- The household creator is the permanent master owner. Members can invite,
-- but only the master owner can delete the shared household.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid := auth.uid();
  target_household uuid;
  target_role public.household_role;
begin
  if target_user is null then raise exception 'Authentication required'; end if;

  select household_id, role into target_household, target_role
  from public.household_members
  where user_id = target_user
  limit 1;

  if target_household is not null and target_role = 'owner' then
    -- Cascades remove memberships and all household-owned records. Other
    -- members keep their personal FamOS logins and may create/join another home.
    delete from public.households
    where id = target_household and created_by = target_user;
  elsif target_household is not null then
    delete from public.household_invitations where invited_by = target_user;
    delete from public.tasks where created_by = target_user;
    delete from public.grocery_items where added_by = target_user;
    delete from public.events where created_by = target_user;
    delete from public.messages where sender_id = target_user;
    delete from public.expenses where created_by = target_user;
    update public.meals
      set cook_ids = array_remove(cook_ids, target_user),
          created_by = case when created_by = target_user then null else created_by end
      where household_id = target_household and target_user = any(cook_ids);
    update public.meals set created_by = null
      where household_id = target_household and created_by = target_user;
    delete from public.household_members
      where household_id = target_household and user_id = target_user;
  end if;

  delete from public.household_invitations where invited_by = target_user;
  delete from public.profiles where id = target_user;
  delete from auth.users where id = target_user;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

create or replace function public.reconcile_existing_household_invitations(target_household uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare matching_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_household_member(target_household) then
    raise exception 'Only household members can check invitations';
  end if;
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
