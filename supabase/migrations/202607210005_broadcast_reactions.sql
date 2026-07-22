-- Let the family react to a broadcast with an emoji.
-- One row per member per emoji, so a member toggles a reaction on/off by
-- inserting/deleting a row.
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (message_id, member_id, reaction)
);

create index if not exists message_reactions_message_idx on public.message_reactions(message_id);
create index if not exists message_reactions_household_idx on public.message_reactions(household_id);

alter table public.message_reactions enable row level security;

-- Any household member can see reactions in their household.
create policy "message reactions read" on public.message_reactions for select to authenticated
using (public.is_household_member(household_id));

-- A member can only add/remove their own reactions, and only in their household.
create policy "message reactions insert" on public.message_reactions for insert to authenticated
with check (public.is_household_member(household_id) and member_id = auth.uid());

create policy "message reactions delete" on public.message_reactions for delete to authenticated
using (public.is_household_member(household_id) and member_id = auth.uid());

alter publication supabase_realtime add table public.message_reactions;
