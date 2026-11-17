begin;

drop policy if exists "household members read grocery photos" on storage.objects;
create policy "household members read grocery photos"
on storage.objects for select to authenticated
using (bucket_id = 'grocery-photos');

drop policy if exists "grocery photos require current household membership" on storage.objects;
create policy "grocery photos require current household membership"
on storage.objects as restrictive for all to anon, authenticated
using (
  case
    when bucket_id <> 'grocery-photos' then true
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      then public.is_household_member(((storage.foldername(name))[1])::uuid)
    else false
  end
)
with check (
  case
    when bucket_id <> 'grocery-photos' then true
    when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      then public.is_household_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

commit;
