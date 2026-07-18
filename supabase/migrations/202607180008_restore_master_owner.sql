-- The account that created a household is its permanent master owner.
-- Restore that membership if an older migration, interrupted invite flow, or
-- accidental row deletion left the creator without a household_members row.
create or replace function public.ensure_creator_household_membership()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_household uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select id into creator_household
  from public.households
  where created_by = auth.uid()
  order by created_at asc
  limit 1;

  if creator_household is null then return null; end if;

  insert into public.household_members(household_id, user_id, role)
  values (creator_household, auth.uid(), 'owner'::public.household_role)
  on conflict (household_id, user_id)
  do update set role = 'owner'::public.household_role;

  return creator_household;
end;
$$;

revoke all on function public.ensure_creator_household_membership() from public, anon;
grant execute on function public.ensure_creator_household_membership() to authenticated;

notify pgrst, 'reload schema';
