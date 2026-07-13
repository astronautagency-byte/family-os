-- Create profiles for users who signed up before the profile trigger was installed.
insert into public.profiles (id, email, display_name, initials)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    split_part(coalesce(users.email, ''), '@', 1)
  ),
  upper(left(coalesce(
    nullif(users.raw_user_meta_data ->> 'display_name', ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    '?'
  ), 2))
from auth.users as users
on conflict (id) do nothing;
