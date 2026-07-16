-- Let invited family members join an existing home without the old two-person cap.
create or replace function public.accept_household_invitation(invitation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation public.household_invitations;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into invitation from public.household_invitations
  where id = invitation_id and accepted_at is null and expires_at > now();

  if not found then raise exception 'Invitation is invalid or expired'; end if;

  if lower(invitation.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Invitation belongs to another email address';
  end if;

  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'You already belong to a household';
  end if;

  insert into public.household_members(household_id, user_id, role)
  values (invitation.household_id, auth.uid(), 'member');

  update public.household_invitations set accepted_at = now() where id = invitation_id;
  return invitation.household_id;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'household_members'
    )
  then
    alter publication supabase_realtime add table public.household_members;
  end if;
end $$;
