create or replace function public.admin_dashboard_overview()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_famos_admin() then jsonb_build_object(
    'households', (select count(*) from public.households),
    'users', (select count(*) from auth.users),
    'activeUsers30d', (select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'),
    'pendingInvites', (select count(*) from public.household_invitations where accepted_at is null and expires_at > now()),
    'tasks30d', (select count(*) from public.tasks where created_at >= now() - interval '30 days'),
    'messages30d', (select count(*) from public.messages where created_at >= now() - interval '30 days'),
    'events30d', (select count(*) from public.events where created_at >= now() - interval '30 days'),
    'groceries30d', (select count(*) from public.grocery_items where created_at >= now() - interval '30 days'),
    'meals30d', (select count(*) from public.meals where created_at >= now() - interval '30 days'),
    'mrrCents', (select coalesce(sum(case when billing_interval = 'year' then amount_cents / 12.0 else amount_cents end), 0)::integer from public.account_subscriptions where status = 'active'),
    'arrCents', (select coalesce(sum(case when billing_interval = 'year' then amount_cents else amount_cents * 12 end), 0)::integer from public.account_subscriptions where status = 'active'),
    'payingHouseholds', (select count(*) from public.account_subscriptions where status = 'active' and amount_cents > 0),
    'trialHouseholds', (select count(*) from public.account_subscriptions where status = 'trial'),
    'pastDueHouseholds', (select count(*) from public.account_subscriptions where status = 'past_due'),
    'currency', coalesce((select currency from public.account_subscriptions where status = 'active' limit 1), 'CAD')
  ) else null end;
$$;

grant execute on function public.admin_dashboard_overview() to authenticated;
