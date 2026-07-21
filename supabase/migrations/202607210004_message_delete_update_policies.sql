-- Messages had only SELECT + INSERT policies. With RLS enabled, DELETE and
-- UPDATE were silently blocked (0 rows affected, no error) — so "Clear chat"
-- appeared to work locally but the rows survived and reloaded on next login,
-- and clearing a broadcast (an UPDATE) never persisted.
--
-- Allow household members to delete/update messages in their household's shared
-- thread, and their own direct messages. Mirrors the existing read policy.

create policy "messages delete"
on public.messages for delete to authenticated
using (
  public.is_household_member(household_id)
  and (
    recipient_id is null
    or sender_id = auth.uid()
    or recipient_id = auth.uid()
  )
);

create policy "messages update"
on public.messages for update to authenticated
using (
  public.is_household_member(household_id)
  and (
    recipient_id is null
    or sender_id = auth.uid()
    or recipient_id = auth.uid()
  )
)
with check (public.is_household_member(household_id));
