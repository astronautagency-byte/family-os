-- Let any household member manage the shared home location & dietary
-- preferences. Previously household_profiles writes were owner-only, so a
-- parent/guardian who isn't the master owner had no way to add the home address
-- (which powers weather, local events, and meal planning).
--
-- The household NAME stays owner-controlled: households table policies are
-- unchanged, and the app only offers renaming to the master owner. The app UI
-- also restricts this editor to parents/guardians (not children).

drop policy if exists "owners manage household profile" on public.household_profiles;

create policy "members manage household profile"
on public.household_profiles for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));
