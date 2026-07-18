-- Repair the confirmed mirrored-household split:
--   master: iamalexvorobiev@gmail.com
--   member: alexv@getastronaut.io
-- Then enforce one home per authenticated account and one active home invite
-- per verified email address.
do $$
declare
  master_user uuid;
  member_user uuid;
  master_household uuid;
  accidental_household uuid;
  accidental_member_count integer;
begin
  select id into master_user
  from public.profiles
  where lower(email) = 'iamalexvorobiev@gmail.com'
  limit 1;

  select id into member_user
  from public.profiles
  where lower(email) = 'alexv@getastronaut.io'
  limit 1;

  if master_user is null then
    raise exception 'Could not find the confirmed master account';
  end if;
  if member_user is null then
    raise exception 'Could not find the invited family member account';
  end if;

  select id into master_household
  from public.households
  where created_by = master_user
  order by created_at asc
  limit 1;

  if master_household is null then
    raise exception 'Could not find the master account household';
  end if;

  insert into public.household_members(household_id, user_id, role)
  values (master_household, master_user, 'owner'::public.household_role)
  on conflict (household_id, user_id)
  do update set role = 'owner'::public.household_role;

  select id into accidental_household
  from public.households
  where created_by = member_user
    and id <> master_household
  order by created_at asc
  limit 1;

  if accidental_household is not null then
    select count(*) into accidental_member_count
    from public.household_members
    where household_id = accidental_household;

    if accidental_member_count > 1 then
      raise exception 'The accidental household has other joined members; refusing automatic deletion';
    end if;

    -- This is the duplicate shell created while the real invitation was
    -- waiting. Cascades remove its mirrored invitation and test-only records.
    delete from public.households where id = accidental_household;
  end if;

  delete from public.household_members
  where user_id = member_user and household_id <> master_household;

  insert into public.household_members(household_id, user_id, role)
  values (master_household, member_user, 'member'::public.household_role)
  on conflict (household_id, user_id)
  do update set role = 'member'::public.household_role;

  update public.household_invitations
  set accepted_at = now()
  where household_id = master_household
    and lower(email) = 'alexv@getastronaut.io'
    and accepted_at is null;

  delete from public.household_invitations
  where lower(email) = 'iamalexvorobiev@gmail.com'
    and accepted_at is null;
end;
$$;

-- A login is a person, and a person belongs to exactly one FamOS home.
create unique index if not exists household_members_one_home_per_user
on public.household_members(user_id);

-- An email cannot simultaneously be waiting to join two different homes.
create unique index if not exists household_invitations_one_active_home_per_email
on public.household_invitations(lower(email))
where accepted_at is null;

notify pgrst, 'reload schema';
