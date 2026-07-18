alter table public.admin_users add column if not exists username text;

create unique index if not exists admin_users_username_unique
  on public.admin_users(lower(username)) where username is not null;

create or replace function public.admin_login_email(login_name text)
returns text language sql stable security definer set search_path = '' as $$
  select email from public.admin_users
  where is_active = true
    and (lower(username) = lower(trim(login_name)) or lower(email) = lower(trim(login_name)))
  limit 1;
$$;
revoke all on function public.admin_login_email(text) from public;
grant execute on function public.admin_login_email(text) to anon, authenticated;

create or replace function public.admin_update_own_username(next_username text)
returns void language plpgsql security definer set search_path = '' as $$
declare normalized text := lower(trim(next_username));
begin
  if not public.is_famos_admin() then raise exception 'Admin access required'; end if;
  if normalized !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'Username must be 3-32 characters using letters, numbers, dots, dashes, or underscores';
  end if;
  update public.admin_users set username = normalized, updated_at = now()
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and is_active = true;
  perform public.admin_log('update_admin_username', 'admin', auth.uid()::text, jsonb_build_object('username', normalized));
end;
$$;
grant execute on function public.admin_update_own_username(text) to authenticated;

create or replace function public.sync_admin_auth_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.admin_users set email = lower(new.email), updated_at = now() where user_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists sync_admin_auth_email_trigger on auth.users;
create trigger sync_admin_auth_email_trigger
after update of email on auth.users for each row execute function public.sync_admin_auth_email();
