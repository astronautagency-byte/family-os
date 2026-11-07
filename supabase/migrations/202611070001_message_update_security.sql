begin;
-- Replace known permissive legacy policies and add a restrictive author guard
-- so another permissive policy cannot silently reopen this operation.
drop policy if exists "messages update" on public.messages;
drop policy if exists "entitled messages update" on public.messages;
create policy "entitled messages update" on public.messages
for update to authenticated
using (sender_id = auth.uid() and public.is_household_member(household_id)
  and public.has_household_feature(household_id, 'chat'))
with check (sender_id = auth.uid() and public.is_household_member(household_id)
  and public.has_household_feature(household_id, 'chat'));
create policy "message author update guard" on public.messages as restrictive
for update to authenticated
using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- Editing text must never move a message to a new channel or impersonate
-- another author, including via a privileged application write.
create or replace function public.preserve_message_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.sender_id is distinct from old.sender_id
    or new.household_id is distinct from old.household_id
    or new.recipient_id is distinct from old.recipient_id then
    raise exception 'Message author and channel cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_message_identity() from public;
create trigger preserve_message_identity before update on public.messages
for each row execute function public.preserve_message_identity();
select pg_notify('pgrst', 'reload schema');
commit;
