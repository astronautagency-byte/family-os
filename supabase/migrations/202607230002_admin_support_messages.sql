-- Admin RPCs for the support messages console.
-- Allows FamOS operators to read, filter, and triage messages
-- submitted via the in-app support forms in Settings.

-- List support_messages with filtering and pagination (admins only).
create or replace function public.admin_list_support_messages(
  category_filter text default '',
  status_filter text default '',
  search_text text default '',
  page_limit integer default 100,
  page_offset integer default 0
)
returns table (
  id bigint, created_at timestamptz, category text, subject text, message text,
  sender_email text, priority text, steps text, status text,
  user_id uuid, household_id uuid, household_name text, app_version text
) language sql stable security definer set search_path = '' as $$
  select s.id, s.created_at, s.category, s.subject, s.message,
    s.sender_email, s.priority, s.steps, s.status,
    s.user_id, s.household_id, s.household_name, s.app_version
  from public.support_messages s
  where public.is_famos_admin()
    and (coalesce(category_filter, '') = '' or s.category = category_filter)
    and (coalesce(status_filter, '') = '' or s.status = status_filter)
    and (coalesce(search_text, '') = ''
      or s.subject ilike '%' || search_text || '%'
      or s.message ilike '%' || search_text || '%'
      or s.sender_email ilike '%' || search_text || '%'
      or s.household_name ilike '%' || search_text || '%')
  order by s.created_at desc
  limit greatest(1, least(page_limit, 500)) offset greatest(page_offset, 0);
$$;

-- Get a single support message detail (admins only).
create or replace function public.admin_get_support_message(target_id bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_famos_admin() then to_jsonb(s) else null end
  from public.support_messages s
  where s.id = target_id;
$$;

-- Update support message status (admins only).
create or replace function public.admin_update_support_message_status(
  target_id bigint, next_status text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  if next_status not in ('new', 'read', 'replied', 'closed') then
    raise exception 'Invalid status: must be new, read, replied, or closed';
  end if;
  update public.support_messages set status = next_status where id = target_id;
  perform public.admin_log('update_support_status', 'support_message', target_id::text,
    jsonb_build_object('status', next_status));
end;
$$;

-- Count support messages by status for the badge (admins only).
create or replace function public.admin_support_message_counts()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_famos_admin() then (
    select jsonb_object_agg(status, cnt) from (
      select coalesce(status, 'new') as status, count(*)::integer as cnt
      from public.support_messages
      group by status
    ) counts
  ) else null end;
$$;

grant execute on function public.admin_list_support_messages(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_get_support_message(bigint) to authenticated;
grant execute on function public.admin_update_support_message_status(bigint, text) to authenticated;
grant execute on function public.admin_support_message_counts() to authenticated;
