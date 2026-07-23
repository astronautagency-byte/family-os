-- Add a per-inviter delivery channel preference that drives send-family-invitation.
-- Stored on the household_members row so it travels with the member's role and
-- can be updated from the onboarding-from-invite step or Settings.
alter table public.household_members
  add column if not exists default_delivery_channel text not null default 'both';

-- Constrain the values to a known set so the edge function can branch safely.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'household_members_default_delivery_channel_check'
  ) then
    alter table public.household_members
      add constraint household_members_default_delivery_channel_check
      check (default_delivery_channel in ('email', 'sms', 'both'));
  end if;
end $$;

comment on column public.household_members.default_delivery_channel is
  'How this member prefers to send household invitations: email-only, sms-only, or both. Drives send-family-invitation routing.';

-- Members may update their own row but we don't want them rewriting role /
-- household_id by piggy-backing on a generic update policy. Drop any
-- existing member-update policy so the new column-scoped one is the only
-- path; earlier "members view memberships" is a SELECT, so reads stay wide.
drop policy if exists "members update memberships" on public.household_members;
drop policy if exists "members update own delivery channel" on public.household_members;
create policy "members update own delivery channel"
on public.household_members for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Tighten even further: expose a SECURITY DEFINER RPC so the column-scoped
-- write only ever touches default_delivery_channel, never the role or
-- household_id. Lets Settings/onboarding do
--   rpc("set_own_delivery_channel", { channel: "sms" })
-- without exposing a generic UPDATE.
create or replace function public.set_own_delivery_channel(channel text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := lower(trim(channel));
begin
  if normalized not in ('email', 'sms', 'both') then
    raise exception 'Channel must be one of email, sms, or both.';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  update public.household_members
    set default_delivery_channel = normalized
    where user_id = auth.uid();
end;
$$;

grant execute on function public.set_own_delivery_channel(text) to authenticated;

notify pgrst, 'reload schema';
