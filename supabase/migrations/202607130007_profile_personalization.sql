-- Keep a user's visible name aligned with their auth-provider profile when the
-- existing name is only the email prefix. Explicitly edited names are preserved.
update public.profiles as profiles
set display_name = coalesce(
      nullif(users.raw_user_meta_data ->> 'display_name', ''),
      nullif(users.raw_user_meta_data ->> 'full_name', ''),
      nullif(users.raw_user_meta_data ->> 'name', ''),
      profiles.display_name
    ),
    initials = upper(left(coalesce(
      nullif(users.raw_user_meta_data ->> 'display_name', ''),
      nullif(users.raw_user_meta_data ->> 'full_name', ''),
      nullif(users.raw_user_meta_data ->> 'name', ''),
      profiles.display_name,
      '?'
    ), 2))
from auth.users as users
where profiles.id = users.id
  and lower(profiles.display_name) = lower(split_part(profiles.email, '@', 1));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  provider_name text := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );
begin
  insert into public.profiles (id, email, display_name, initials, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    provider_name,
    upper(left(provider_name, 2)),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
      nullif(new.raw_user_meta_data ->> 'picture', ''),
      ''
    )
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = case
        when public.profiles.display_name = ''
          or lower(public.profiles.display_name) = lower(split_part(public.profiles.email, '@', 1))
        then excluded.display_name
        else public.profiles.display_name
      end,
      initials = case
        when public.profiles.display_name = ''
          or lower(public.profiles.display_name) = lower(split_part(public.profiles.email, '@', 1))
        then excluded.initials
        else public.profiles.initials
      end,
      avatar_url = case
        when excluded.avatar_url <> '' then excluded.avatar_url
        else public.profiles.avatar_url
      end;
  return new;
end;
$$;
