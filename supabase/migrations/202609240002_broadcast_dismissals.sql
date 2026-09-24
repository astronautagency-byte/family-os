create table public.broadcast_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key(user_id,message_id)
);
alter table public.broadcast_dismissals enable row level security;
grant select,insert,update on public.broadcast_dismissals to authenticated;
create policy "read own dismissals" on public.broadcast_dismissals for select to authenticated using(user_id=auth.uid());
create policy "dismiss visible broadcasts" on public.broadcast_dismissals for insert to authenticated with check(
 user_id=auth.uid() and exists(select 1 from public.messages m where m.id=message_id and public.is_household_member(m.household_id))
);
create policy "update own dismissals" on public.broadcast_dismissals for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
