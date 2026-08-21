-- The household owner (role 'owner' in household_members) can rename family
-- members and update their color/initials/avatar from Settings. The default
-- "users update own profile" policy only allows id = auth.uid(), so the
-- owner's edit would otherwise be rejected by RLS.
--
-- The owner can update any profile row belonging to someone in one of the
-- households they own. The existing "users update own profile" policy still
-- covers self-edits; this adds the admin path.
drop policy if exists "household owners manage member profiles" on public.profiles;
create policy "household owners manage member profiles" on public.profiles
  for update to authenticated
  using (
    exists (
      select 1
      from public.household_members admin_row
      where admin_row.user_id = auth.uid()
        and admin_row.role = 'owner'
        and exists (
          select 1
          from public.household_members target_row
          where target_row.user_id = public.profiles.id
            and target_row.household_id = admin_row.household_id
        )
    )
  )
  with check (
    exists (
      select 1
      from public.household_members admin_row
      where admin_row.user_id = auth.uid()
        and admin_row.role = 'owner'
        and exists (
          select 1
          from public.household_members target_row
          where target_row.user_id = public.profiles.id
            and target_row.household_id = admin_row.household_id
        )
    )
  );
