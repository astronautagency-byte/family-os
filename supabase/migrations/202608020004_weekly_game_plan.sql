create table if not exists public.weekly_game_plans (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  week_start date not null, status text not null default 'draft' check (status in ('draft','published')),
  steps jsonb not null default '[]'::jsonb, published_at timestamptz,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(household_id,week_start)
);
alter table public.weekly_game_plans enable row level security;
create policy "household game plans read" on public.weekly_game_plans for select to authenticated using (public.is_household_member(household_id));
create policy "members create game plans" on public.weekly_game_plans for insert to authenticated with check (public.is_household_member(household_id) and created_by=auth.uid());
create policy "members update game plans" on public.weekly_game_plans for update to authenticated using (public.is_household_member(household_id));
create index if not exists weekly_game_plans_household_week_idx on public.weekly_game_plans(household_id,week_start desc);
