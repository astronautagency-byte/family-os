-- Backfill missing household_profiles rows + completed_at values so
-- households signed up before household_profiles was introduced (or
-- before the partial-completion bug) don't get routed through the
-- 6-step OwnerProfile wizard on every sign-in.
--
-- Idempotent: re-running this migration is a no-op. The INSERT branch
-- only fires for households that have no row yet, and the ON CONFLICT
-- branch only updates rows whose completed_at IS NULL. Service role
-- (the role Supabase migrations run under) bypasses RLS, so no
-- privilege dance is needed.

insert into public.household_profiles (household_id, completed_at, adult_count, family_size, child_count, profile_type)
  select h.id,
         now(),
         coalesce((select count(*) from public.household_members hm where hm.household_id = h.id), 1),
         greatest(coalesce((select count(*) from public.household_members hm where hm.household_id = h.id), 1), 1),
         0,
         'parent'
  from public.households h
  where not exists (
    select 1
    from public.household_profiles p
    where p.household_id = h.id
  )
  on conflict (household_id) do update
    set completed_at = now()
    where public.household_profiles.completed_at is null;
