create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid := auth.uid();
  target_household uuid;
  remaining_user uuid;
begin
  if target_user is null then
    raise exception 'Authentication required';
  end if;

  select household_id into target_household
  from public.household_members
  where user_id = target_user
  limit 1;

  if target_household is not null then
    select user_id into remaining_user
    from public.household_members
    where household_id = target_household
      and user_id <> target_user
    limit 1;

    if remaining_user is null then
      delete from public.households where id = target_household;
    else
      delete from public.household_invitations where invited_by = target_user;
      delete from public.tasks where created_by = target_user;
      delete from public.grocery_items where added_by = target_user;
      delete from public.events where created_by = target_user;
      delete from public.messages where sender_id = target_user;
      delete from public.expenses where created_by = target_user;
      update public.meals
      set cook_ids = array_remove(cook_ids, target_user)
      where household_id = target_household
        and target_user = any(cook_ids);
      update public.households
      set created_by = remaining_user
      where id = target_household
        and created_by = target_user;
      delete from public.household_members
      where household_id = target_household
        and user_id = target_user;
    end if;
  end if;

  delete from public.household_invitations where invited_by = target_user;
  delete from public.profiles where id = target_user;
  delete from auth.users where id = target_user;
end;
$$;

revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
