-- An invited account must join the home waiting for its verified email instead
-- of creating a second household and producing two mirrored pending invites.
create or replace function public.create_household(household_name text default 'Our family')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  account_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  waiting_home text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household';
  end if;

  select household.name into waiting_home
  from public.household_invitations invitation
  join public.households household on household.id = invitation.household_id
  where lower(invitation.email) = account_email
    and invitation.accepted_at is null
    and invitation.expires_at > now()
  order by invitation.created_at desc
  limit 1;

  if waiting_home is not null then
    raise exception 'You already have an invitation to %. Join that home instead of creating another one.', waiting_home;
  end if;

  insert into public.households(name, created_by)
  values (coalesce(nullif(trim(household_name), ''), 'Our family'), auth.uid())
  returning id into new_id;

  insert into public.household_members(household_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return new_id;
end;
$$;

revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

notify pgrst, 'reload schema';
