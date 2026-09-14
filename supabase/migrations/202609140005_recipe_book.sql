create table public.household_recipes (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 title text not null check(length(title) between 1 and 200),
 recipe jsonb not null check(jsonb_typeof(recipe)='object' and octet_length(recipe::text)<5000000),
 created_at timestamptz not null default now()
);
alter table public.household_recipes enable row level security;
revoke all on public.household_recipes from anon;
grant select,insert,update,delete on public.household_recipes to authenticated;
create policy recipe_book_read on public.household_recipes for select to authenticated using(public.is_household_member(household_id));
create policy recipe_book_insert on public.household_recipes for insert to authenticated with check(public.is_household_member(household_id) and created_by=auth.uid());
create policy recipe_book_update on public.household_recipes for update to authenticated using(public.is_household_member(household_id) and created_by=auth.uid()) with check(public.is_household_member(household_id) and created_by=auth.uid());
create policy recipe_book_delete on public.household_recipes for delete to authenticated using(public.is_household_member(household_id) and created_by=auth.uid());
create index household_recipes_household on public.household_recipes(household_id,created_at desc);
alter table public.meals add column if not exists recipe_snapshot jsonb;
