-- Automatically turn matching invitation emails into household membership.
-- This keeps Settings from showing "pending" when the invited person already has an account.

create or replace function public.accept_matching_household_invitation()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  invitation public.household_invitations;
  accepted_household_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    return null;
  end if;

  select * into invitation
  from public.household_invitations
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then return null; end if;

  insert into public.household_members(household_id, user_id, role)
  values (invitation.household_id, auth.uid(), 'member')
  on conflict do nothing;

  update public.household_invitations
  set accepted_at = now()
  where id = invitation.id;

  accepted_household_id := invitation.household_id;
  return accepted_household_id;
end;
$$;

create or replace function public.reconcile_existing_household_invitations(target_household uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  changed_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1
    from public.household_members
    where household_id = target_household
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Only household owners can reconcile invitations';
  end if;

  with matched as (
    select i.id as invitation_id, p.id as user_id
    from public.household_invitations i
    join public.profiles p on lower(p.email) = lower(i.email)
    where i.household_id = target_household
      and i.accepted_at is null
      and i.expires_at > now()
  ),
  eligible as (
    select matched.*
    from matched
    where not exists (
      select 1 from public.household_members any_membership
      where any_membership.user_id = matched.user_id
    )
  ),
  inserted as (
    insert into public.household_members(household_id, user_id, role)
    select target_household, user_id, 'member'::public.household_role
    from eligible
    on conflict do nothing
    returning user_id
  ),
  accepted as (
    update public.household_invitations invitation
    set accepted_at = now()
    from matched
    where invitation.id = matched.invitation_id
      and exists (
        select 1
        from public.household_members membership
        where membership.household_id = target_household
          and membership.user_id = matched.user_id
      )
    returning invitation.id
  )
  select count(*) into changed_count from accepted;

  return changed_count;
end;
$$;

grant execute on function public.accept_matching_household_invitation() to authenticated;
grant execute on function public.reconcile_existing_household_invitations(uuid) to authenticated;

select pg_notify('pgrst', 'reload schema');
