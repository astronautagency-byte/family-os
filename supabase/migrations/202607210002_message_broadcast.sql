-- Broadcast messages: a household announcement shown on recipients' home screens.
-- A broadcast is a normal household message (recipient_id null) with broadcast=true.
-- The application always excludes these records from chat. Each recipient dismisses
-- the home-screen banner independently; the broadcast flag is never cleared.

alter table public.messages
  add column if not exists broadcast boolean not null default false;

-- Fast lookup of the currently-active broadcasts for a household.
create index if not exists messages_household_broadcast_idx
  on public.messages(household_id, created_at)
  where broadcast = true;
