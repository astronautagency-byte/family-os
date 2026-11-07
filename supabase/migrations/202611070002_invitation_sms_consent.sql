-- Record the household member's confirmation for a one-time invitation text.
-- This is an attestation by the inviter, not independent proof of recipient consent.
alter table public.household_invitations
  add column if not exists sms_consent_confirmed_at timestamptz,
  add column if not exists sms_consent_confirmed_by uuid references auth.users(id) on delete set null;
notify pgrst, 'reload schema';

-- Service-only atomic cooldown limits tests across serverless instances.
create table if not exists public.delivery_test_cooldowns (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_claimed_at timestamptz not null
);
alter table public.delivery_test_cooldowns enable row level security;
revoke all on public.delivery_test_cooldowns from public, anon, authenticated;
create or replace function public.claim_delivery_test(target_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.delivery_test_cooldowns(user_id,last_claimed_at)
  values (target_user, now())
  on conflict (user_id) do update set last_claimed_at=excluded.last_claimed_at
    where public.delivery_test_cooldowns.last_claimed_at < now() - interval '1 minute';
  return found;
end;
$$;
revoke all on function public.claim_delivery_test(uuid) from public, anon, authenticated;
grant execute on function public.claim_delivery_test(uuid) to service_role;
