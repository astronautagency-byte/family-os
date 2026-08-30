-- Persist the founder-welcome and feature-tour "seen" flags in the database
-- so they never reappear on a different device or after clearing localStorage.
-- Columns live on household_members (one row per user).

alter table public.household_members
  add column if not exists founder_welcome_seen boolean not null default false,
  add column if not exists feature_tour_seen boolean not null default false;

comment on column public.household_members.founder_welcome_seen is
  'Set to true once the user has seen (and dismissed) the founder welcome modal. Never re-shows.';
comment on column public.household_members.feature_tour_seen is
  'Set to true once the user has completed or skipped the first-login feature tour. Never re-shows.';

-- Tight RPCs so the client can flip either flag without exposing a generic UPDATE.
create or replace function public.mark_founder_welcome_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  update public.household_members
    set founder_welcome_seen = true
    where user_id = auth.uid();
end;
$$;

create or replace function public.mark_feature_tour_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  update public.household_members
    set feature_tour_seen = true
    where user_id = auth.uid();
end;
$$;

grant execute on function public.mark_founder_welcome_seen() to authenticated;
grant execute on function public.mark_feature_tour_seen() to authenticated;

notify pgrst, 'reload schema';
