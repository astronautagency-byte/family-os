begin;
update storage.buckets set public = false where id = 'support-screenshots';
drop policy if exists "Public read access for support screenshots" on storage.objects;
drop policy if exists "Authenticated users can upload support screenshots" on storage.objects;
drop policy if exists "Users can delete own support screenshots" on storage.objects;
drop policy if exists "support screenshots restricted to service operations" on storage.objects;
create policy "support screenshots restricted to service operations"
on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'support-screenshots')
with check (bucket_id <> 'support-screenshots');
commit;
