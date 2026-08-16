-- Chargebee Product Catalog 2.0 household feature billing.
alter table public.account_subscriptions
  add column if not exists chargebee_customer_id text,
  add column if not exists chargebee_subscription_id text,
  add column if not exists chargebee_items jsonb not null default '[]'::jsonb;

create unique index if not exists account_subscriptions_chargebee_customer_idx
  on public.account_subscriptions(chargebee_customer_id) where chargebee_customer_id is not null;
create unique index if not exists account_subscriptions_chargebee_subscription_idx
  on public.account_subscriptions(chargebee_subscription_id) where chargebee_subscription_id is not null;

create or replace function public.has_household_feature(target_household uuid, feature_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    feature_key in ('calendar', 'tasks', 'groceries', 'chat', 'kitchen')
    or exists (
      select 1 from public.account_subscriptions s
      where s.household_id = target_household
        and s.provider = 'chargebee'
        and s.status in ('trial', 'active')
        and s.chargebee_items @> jsonb_build_array(feature_key)
    )
    -- Preserve access for households already paying through the retiring
    -- Stripe catalog until they are migrated to Chargebee.
    or exists (
      select 1 from public.account_subscriptions s
      where s.household_id = target_household
        and s.provider = 'stripe' and s.status in ('trial', 'active')
    )
    or exists (
      select 1 from public.household_feature_overrides o
      where o.household_id = target_household and o.feature_key = feature_key and o.enabled = true
    );
$$;
revoke all on function public.has_household_feature(uuid, text) from public;
grant execute on function public.has_household_feature(uuid, text) to authenticated, service_role;

create or replace function public.get_my_entitlements()
returns jsonb language sql stable security definer set search_path = '' as $$
  with home as (
    select hm.household_id from public.household_members hm where hm.user_id = auth.uid() limit 1
  )
  select jsonb_build_object(
    'provider', coalesce(s.provider, 'chargebee'),
    'status', coalesce(s.status, 'free'),
    'isOwner', h.created_by = auth.uid(),
    'features', jsonb_build_object(
      'calendar', true, 'tasks', true, 'groceries', true, 'chat', true, 'kitchen', true,
      'meals', public.has_household_feature(home.household_id, 'meals'),
      'fam_ai', public.has_household_feature(home.household_id, 'fam_ai'),
      'family', public.has_household_feature(home.household_id, 'family')
    )
  )
  from home join public.households h on h.id = home.household_id
  left join public.account_subscriptions s on s.household_id = home.household_id;
$$;
revoke all on function public.get_my_entitlements() from public;
grant execute on function public.get_my_entitlements() to authenticated;

create or replace function public.upsert_from_chargebee(
  target_household uuid, customer_id text, subscription_id text,
  next_status text, item_features jsonb, next_amount_cents integer,
  next_currency text, period_start timestamptz, period_end timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'service_role only'; end if;
  insert into public.account_subscriptions (
    household_id, provider, plan_key, status, amount_cents, currency, billing_interval,
    external_customer_id, external_subscription_id, chargebee_customer_id,
    chargebee_subscription_id, chargebee_items, current_period_start,
    current_period_end, started_at, updated_at
  ) values (
    target_household, 'chargebee', 'free-plus-features', next_status, greatest(next_amount_cents, 0),
    upper(next_currency), 'month', customer_id, subscription_id, customer_id,
    subscription_id, item_features, period_start, period_end, now(), now()
  ) on conflict (household_id) do update set
    provider = 'chargebee', status = excluded.status, amount_cents = excluded.amount_cents,
    currency = excluded.currency, external_customer_id = excluded.external_customer_id,
    external_subscription_id = excluded.external_subscription_id,
    chargebee_customer_id = excluded.chargebee_customer_id,
    chargebee_subscription_id = excluded.chargebee_subscription_id,
    chargebee_items = excluded.chargebee_items,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end, updated_at = now();
end;
$$;
revoke all on function public.upsert_from_chargebee(uuid,text,text,text,jsonb,integer,text,timestamptz,timestamptz) from public;
grant execute on function public.upsert_from_chargebee(uuid,text,text,text,jsonb,integer,text,timestamptz,timestamptz) to service_role;

-- Premium data is protected at the database boundary, not only hidden in React.
drop policy if exists "household meals" on public.meals;
create policy "entitled household meals" on public.meals for all to authenticated
using (public.is_household_member(household_id) and public.has_household_feature(household_id, 'meals'))
with check (public.is_household_member(household_id) and public.has_household_feature(household_id, 'meals'));

drop policy if exists "household kitchen inventory" on public.kitchen_inventory;
create policy "entitled household kitchen inventory" on public.kitchen_inventory for all to authenticated
using (public.is_household_member(household_id) and public.has_household_feature(household_id, 'kitchen'))
with check (public.is_household_member(household_id) and public.has_household_feature(household_id, 'kitchen'));

drop policy if exists "direct messages read" on public.messages;
drop policy if exists "direct messages send" on public.messages;
drop policy if exists "messages delete" on public.messages;
drop policy if exists "messages update" on public.messages;
create policy "entitled direct messages read" on public.messages for select to authenticated using (
  public.has_household_feature(household_id, 'chat') and public.is_household_member(household_id)
  and (recipient_id is null or sender_id = auth.uid() or recipient_id = auth.uid())
);
create policy "entitled direct messages send" on public.messages for insert to authenticated with check (
  public.has_household_feature(household_id, 'chat') and public.is_household_member(household_id)
  and sender_id = auth.uid() and (recipient_id is null or public.shares_household(recipient_id))
);
create policy "entitled messages delete" on public.messages for delete to authenticated using (
  public.has_household_feature(household_id, 'chat') and public.is_household_member(household_id)
  and (recipient_id is null or sender_id = auth.uid() or recipient_id = auth.uid())
);
create policy "entitled messages update" on public.messages for update to authenticated using (
  public.has_household_feature(household_id, 'chat') and public.is_household_member(household_id)
  and (recipient_id is null or sender_id = auth.uid() or recipient_id = auth.uid())
) with check (public.has_household_feature(household_id, 'chat') and public.is_household_member(household_id));

select pg_notify('pgrst', 'reload schema');
