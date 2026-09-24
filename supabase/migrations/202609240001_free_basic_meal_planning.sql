-- Basic meal CRUD belongs to every household, independently of billing.
-- Keep has_household_feature('meals') unchanged: legacy callers use that
-- entitlement for premium recipe discovery / Meal Roulette.
drop policy if exists "entitled household meals" on public.meals;
drop policy if exists "household meals" on public.meals;
create policy "household meals" on public.meals for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

notify pgrst, 'reload schema';
