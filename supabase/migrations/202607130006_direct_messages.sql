alter table public.messages
  add column if not exists recipient_id uuid references public.profiles(id) on delete cascade;

create index if not exists messages_recipient_created_idx
  on public.messages(household_id, recipient_id, created_at);

drop policy if exists "household messages read" on public.messages;
drop policy if exists "household messages send" on public.messages;

create policy "direct messages read"
on public.messages for select to authenticated
using (
  public.is_household_member(household_id)
  and (
    recipient_id is null
    or sender_id = auth.uid()
    or recipient_id = auth.uid()
  )
);

create policy "direct messages send"
on public.messages for insert to authenticated
with check (
  public.is_household_member(household_id)
  and sender_id = auth.uid()
  and (
    recipient_id is null
    or public.shares_household(recipient_id)
  )
);

select pg_notify('pgrst', 'reload schema');
