create table if not exists public.admin_users (
  email text primary key,
  user_id uuid unique references auth.users(id) on delete set null,
  role text not null default 'admin' check (role in ('owner', 'admin', 'support', 'analyst')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.admin_users (email, role)
values ('iamalexvorobiev@gmail.com', 'owner')
on conflict (email) do nothing;

create table if not exists public.feature_flags (
  key text primary key,
  name text not null,
  description text not null default '',
  default_enabled boolean not null default true,
  category text not null default 'core',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, name, description, default_enabled, category) values
  ('calendar', 'Calendar', 'Shared FamOS calendar and external calendar connections.', true, 'core'),
  ('meals', 'Meals', 'Meal planning, saved recipes, and cook mode.', true, 'core'),
  ('groceries', 'Groceries', 'Shared grocery lists, barcode scanner, and focus shop.', true, 'core'),
  ('tasks', 'Tasks', 'Task creation, assignment, and completion.', true, 'core'),
  ('chat', 'Chat', 'Household and direct family messages.', true, 'core'),
  ('fam_ai', 'Fam AI', 'AI-assisted family planning features.', true, 'premium'),
  ('finance', 'Finance', 'Household budgets, expenses, and receipt analysis.', false, 'premium'),
  ('push_notifications', 'Push notifications', 'Browser and installed-app push alerts.', true, 'communications'),
  ('email_notifications', 'Email notifications', 'Transactional and reminder emails.', true, 'communications'),
  ('sms_invitations', 'SMS invitations', 'One-time SMS household invitations.', true, 'communications')
on conflict (key) do update set name = excluded.name, description = excluded.description, category = excluded.category;

create table if not exists public.household_feature_overrides (
  household_id uuid not null references public.households(id) on delete cascade,
  feature_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean not null,
  reason text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (household_id, feature_key)
);

create table if not exists public.household_account_status (
  household_id uuid primary key references public.households(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'trial', 'past_due', 'suspended', 'disabled')),
  note text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.account_subscriptions (
  household_id uuid primary key references public.households(id) on delete cascade,
  provider text not null default 'manual',
  plan_key text not null default 'family',
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'canceled', 'paused')),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'CAD',
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  external_customer_id text,
  external_subscription_id text,
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_email text not null default '',
  action text not null,
  target_type text not null,
  target_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);
create index if not exists subscriptions_status_idx on public.account_subscriptions(status);

alter table public.admin_users enable row level security;
alter table public.feature_flags enable row level security;
alter table public.household_feature_overrides enable row level security;
alter table public.household_account_status enable row level security;
alter table public.account_subscriptions enable row level security;
alter table public.admin_audit_log enable row level security;

create or replace function public.is_famos_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and is_active = true
  );
$$;

revoke all on function public.is_famos_admin() from public;
grant execute on function public.is_famos_admin() to authenticated;

create or replace function public.household_runtime_config(target_household uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when exists (
    select 1 from public.household_members where household_id = target_household and user_id = auth.uid()
  ) or public.is_famos_admin() then jsonb_build_object(
    'status', coalesce((select status from public.household_account_status where household_id = target_household), 'active'),
    'features', coalesce((select jsonb_object_agg(f.key, coalesce(o.enabled, f.default_enabled))
      from public.feature_flags f left join public.household_feature_overrides o
        on o.feature_key = f.key and o.household_id = target_household), '{}'::jsonb)
  ) else null end;
$$;

grant execute on function public.household_runtime_config(uuid) to authenticated;

create policy "Admins read admin users" on public.admin_users for select to authenticated using (public.is_famos_admin());
create policy "Admins read feature flags" on public.feature_flags for select to authenticated using (public.is_famos_admin());
create policy "Admins read feature overrides" on public.household_feature_overrides for select to authenticated using (public.is_famos_admin());
create policy "Admins read account status" on public.household_account_status for select to authenticated using (public.is_famos_admin());
create policy "Admins read subscriptions" on public.account_subscriptions for select to authenticated using (public.is_famos_admin());
create policy "Admins read audit log" on public.admin_audit_log for select to authenticated using (public.is_famos_admin());

create or replace function public.admin_log(action_name text, target_kind text, target_value text, payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  insert into public.admin_audit_log (admin_user_id, admin_email, action, target_type, target_id, details)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''), action_name, target_kind, coalesce(target_value, ''), coalesce(payload, '{}'::jsonb));
end;
$$;

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

create or replace function public.admin_list_households(search_text text default '', page_limit integer default 100, page_offset integer default 0)
returns table (
  household_id uuid, household_name text, created_at timestamptz, owner_email text,
  member_count bigint, task_count bigint, message_count bigint, event_count bigint,
  grocery_count bigint, meal_count bigint, account_status text, subscription_status text,
  amount_cents integer, billing_interval text
) language sql stable security definer set search_path = '' as $$
  select h.id, h.name, h.created_at, owner.email,
    (select count(*) from public.household_members hm where hm.household_id = h.id),
    (select count(*) from public.tasks t where t.household_id = h.id),
    (select count(*) from public.messages m where m.household_id = h.id),
    (select count(*) from public.events e where e.household_id = h.id),
    (select count(*) from public.grocery_items g where g.household_id = h.id),
    (select count(*) from public.meals ml where ml.household_id = h.id),
    coalesce(st.status, 'active'), coalesce(s.status, 'none'), coalesce(s.amount_cents, 0), coalesce(s.billing_interval, 'month')
  from public.households h
  left join public.profiles owner on owner.id = h.created_by
  left join public.household_account_status st on st.household_id = h.id
  left join public.account_subscriptions s on s.household_id = h.id
  where public.is_famos_admin()
    and (coalesce(search_text, '') = '' or h.name ilike '%' || search_text || '%' or owner.email ilike '%' || search_text || '%')
  order by h.created_at desc
  limit greatest(1, least(page_limit, 250)) offset greatest(page_offset, 0);
$$;

create or replace function public.admin_household_detail(target_household uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_famos_admin() then jsonb_build_object(
    'household', (select to_jsonb(x) from (
      select h.id, h.name, h.created_at, h.updated_at, coalesce(st.status, 'active') as status, coalesce(st.note, '') as status_note,
        hp.address, hp.city, hp.country, hp.family_size, hp.adult_count, hp.child_count
      from public.households h
      left join public.household_account_status st on st.household_id = h.id
      left join public.household_profiles hp on hp.household_id = h.id
      where h.id = target_household
    ) x),
    'members', coalesce((select jsonb_agg(to_jsonb(x) order by x.joined_at) from (
      select p.id, p.email, p.display_name, hm.role, hm.joined_at,
        u.created_at as account_created_at, u.last_sign_in_at,
        (select count(*) from public.tasks t where t.household_id = target_household and t.assignee_id = p.id) as assigned_tasks,
        (select count(*) from public.messages m where m.household_id = target_household and m.sender_id = p.id) as messages_sent,
        (select count(*) from public.events e where e.household_id = target_household and e.created_by = p.id) as events_created,
        (select count(*) from public.grocery_items g where g.household_id = target_household and g.added_by = p.id) as groceries_added,
        (select count(*) from public.meals ml where ml.household_id = target_household and ml.created_by = p.id) as meals_added
      from public.household_members hm join public.profiles p on p.id = hm.user_id join auth.users u on u.id = p.id
      where hm.household_id = target_household
    ) x), '[]'::jsonb),
    'metrics', jsonb_build_object(
      'tasks', (select count(*) from public.tasks where household_id = target_household),
      'completedTasks', (select count(*) from public.tasks where household_id = target_household and is_done),
      'messages', (select count(*) from public.messages where household_id = target_household),
      'events', (select count(*) from public.events where household_id = target_household),
      'groceries', (select count(*) from public.grocery_items where household_id = target_household),
      'meals', (select count(*) from public.meals where household_id = target_household),
      'expensesCents', (select coalesce(sum(amount), 0) * 100 from public.expenses where household_id = target_household)
    ),
    'subscription', (select to_jsonb(s) from public.account_subscriptions s where s.household_id = target_household),
    'features', coalesce((select jsonb_agg(jsonb_build_object(
      'key', f.key, 'name', f.name, 'description', f.description, 'category', f.category,
      'enabled', coalesce(o.enabled, f.default_enabled), 'overridden', o.enabled is not null
    ) order by f.category, f.name) from public.feature_flags f
      left join public.household_feature_overrides o on o.feature_key = f.key and o.household_id = target_household), '[]'::jsonb)
  ) else null end;
$$;

create or replace function public.admin_set_household_status(target_household uuid, next_status text, status_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  if next_status not in ('active','trial','past_due','suspended','disabled') then raise exception 'Invalid account status'; end if;
  insert into public.household_account_status (household_id, status, note, updated_by)
  values (target_household, next_status, coalesce(status_note, ''), auth.uid())
  on conflict (household_id) do update set status = excluded.status, note = excluded.note, updated_by = auth.uid(), updated_at = now();
  perform public.admin_log('set_household_status', 'household', target_household::text, jsonb_build_object('status', next_status, 'note', status_note));
end;
$$;

create or replace function public.admin_set_feature_override(target_household uuid, target_feature text, next_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  insert into public.household_feature_overrides (household_id, feature_key, enabled, updated_by)
  values (target_household, target_feature, next_enabled, auth.uid())
  on conflict (household_id, feature_key) do update set enabled = excluded.enabled, updated_by = auth.uid(), updated_at = now();
  perform public.admin_log('set_feature_override', 'household', target_household::text, jsonb_build_object('feature', target_feature, 'enabled', next_enabled));
end;
$$;

create or replace function public.admin_upsert_subscription(
  target_household uuid, next_plan text, next_status text, next_amount_cents integer,
  next_currency text default 'CAD', next_interval text default 'month'
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  insert into public.account_subscriptions (household_id, plan_key, status, amount_cents, currency, billing_interval, started_at)
  values (target_household, next_plan, next_status, greatest(next_amount_cents, 0), upper(next_currency), next_interval, now())
  on conflict (household_id) do update set plan_key = excluded.plan_key, status = excluded.status, amount_cents = excluded.amount_cents,
    currency = excluded.currency, billing_interval = excluded.billing_interval, updated_at = now();
  perform public.admin_log('upsert_subscription', 'household', target_household::text, jsonb_build_object('plan', next_plan, 'status', next_status, 'amountCents', next_amount_cents, 'interval', next_interval));
end;
$$;

create or replace function public.admin_remove_household_member(target_household uuid, target_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare member_role public.household_role;
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  select role into member_role from public.household_members where household_id = target_household and user_id = target_user;
  if member_role is null then raise exception 'Household member not found'; end if;
  if member_role = 'owner' then raise exception 'Transfer or delete the household instead of removing its owner'; end if;
  delete from public.household_members where household_id = target_household and user_id = target_user;
  perform public.admin_log('remove_household_member', 'user', target_user::text, jsonb_build_object('householdId', target_household));
end;
$$;

create or replace function public.admin_add_household_member(target_household uuid, target_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare existing_user uuid; existing_home uuid; household_owner uuid;
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  select id into existing_user from auth.users where lower(email) = lower(trim(target_email)) limit 1;
  select created_by into household_owner from public.households where id = target_household;
  if household_owner is null then raise exception 'Household not found'; end if;
  if existing_user is not null then
    select household_id into existing_home from public.household_members where user_id = existing_user limit 1;
    if existing_home is not null and existing_home <> target_household then raise exception 'This user already belongs to another household'; end if;
    insert into public.household_members (household_id, user_id, role) values (target_household, existing_user, 'member')
    on conflict (household_id, user_id) do nothing;
    perform public.admin_log('add_household_member', 'user', existing_user::text, jsonb_build_object('householdId', target_household));
    return 'member_added';
  end if;
  insert into public.household_invitations (household_id, email, invited_by, expires_at)
  values (target_household, lower(trim(target_email)), household_owner, now() + interval '7 days')
  on conflict (household_id, email) do update set accepted_at = null, expires_at = excluded.expires_at, invited_by = excluded.invited_by;
  perform public.admin_log('create_household_invitation', 'email', lower(trim(target_email)), jsonb_build_object('householdId', target_household));
  return 'invitation_created';
end;
$$;

grant execute on function public.admin_dashboard_overview() to authenticated;
grant execute on function public.admin_list_households(text, integer, integer) to authenticated;
grant execute on function public.admin_household_detail(uuid) to authenticated;
grant execute on function public.admin_set_household_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_feature_override(uuid, text, boolean) to authenticated;
grant execute on function public.admin_upsert_subscription(uuid, text, text, integer, text, text) to authenticated;
grant execute on function public.admin_remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.admin_add_household_member(uuid, text) to authenticated;
