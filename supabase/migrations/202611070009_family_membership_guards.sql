begin;
-- A restrictive policy is ANDed with permissive policies. Ordinary table access
-- must always re-check current membership, including with an older valid JWT.
-- Invitations deliberately have a separate recipient acceptance path. Helpers
-- deliberately remain non-members and use the explicitly authorized narrow RPCs.
do $$
declare target text;
begin
  foreach target in array array['tasks','grocery_items','events','messages','meals','expenses','calendars','task_lists','grocery_lists','shared_lists'] loop
    if to_regclass('public.'||target) is not null then
      execute format('alter table public.%I enable row level security',target);
      execute format('create policy "current family membership required" on public.%I as restrictive for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))',target);
    end if;
  end loop;
end;
$$;
notify pgrst,'reload schema';
commit;
