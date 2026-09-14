-- Household Broadcast topics authorize household membership, not DM
-- participation. Never fan out message bodies or reactions through them.
-- Existing Postgres Changes subscriptions enforce the messages SELECT RLS.
drop trigger if exists broadcast_household_change on public.messages;
drop trigger if exists broadcast_household_change on public.message_reactions;

-- Reaction metadata must have the same audience as its parent message.
drop policy if exists "message reactions read" on public.message_reactions;
create policy "message reactions read" on public.message_reactions
for select to authenticated using (
  public.is_household_member(household_id)
  and exists (
    select 1 from public.messages m
    where m.id = message_id and m.household_id = message_reactions.household_id
      and (m.recipient_id is null or m.sender_id = auth.uid() or m.recipient_id = auth.uid())
  )
);
