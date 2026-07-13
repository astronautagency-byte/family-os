alter table public.profiles
  add column if not exists avatar_url text not null default '';

update public.profiles as profiles
set avatar_url = coalesce(
  nullif(users.raw_user_meta_data ->> 'avatar_url', ''),
  nullif(users.raw_user_meta_data ->> 'picture', ''),
  profiles.avatar_url
)
from auth.users as users
where profiles.id = users.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, initials, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    upper(left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      new.email,
      '?'
    ), 2)),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', ''),
      ''
    )
  )
  on conflict (id) do update
  set email = excluded.email,
      avatar_url = case
        when excluded.avatar_url <> '' then excluded.avatar_url
        else public.profiles.avatar_url
      end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();
