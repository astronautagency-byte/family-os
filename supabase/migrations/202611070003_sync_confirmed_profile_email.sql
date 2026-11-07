-- Keep the public profile aligned with the confirmed authentication address.
-- Pending email-change requests do not update auth.users.email.
create or replace function public.sync_confirmed_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles
       set email = new.email, updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_confirmed_profile_email_trigger on auth.users;
create trigger sync_confirmed_profile_email_trigger
after update of email on auth.users
for each row execute function public.sync_confirmed_profile_email();
