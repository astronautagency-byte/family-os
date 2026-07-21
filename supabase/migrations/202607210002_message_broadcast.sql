-- Broadcast messages: a household message pinned to every member's home screen.
-- A broadcast is a normal household message (recipient_id null) with broadcast=true.
-- It stays on the Today screen for everyone until a family member clears it,
-- which flips broadcast back to false (the message remains in chat history).

alter table public.messages
  add column if not exists broadcast boolean not null default false;

-- Fast lookup of the currently-active broadcasts for a household.
create index if not exists messages_household_broadcast_idx
  on public.messages(household_id, created_at)
  where broadcast = true;
