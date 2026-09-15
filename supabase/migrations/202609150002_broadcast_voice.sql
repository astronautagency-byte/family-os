alter table public.messages add column if not exists voice_path text;
alter table public.messages add constraint broadcast_voice_scope check (
  voice_path is null or (
    recipient_id is null and coalesce(source_sender,'') = '__famos_broadcast__'
    and voice_path like household_id::text || '/' || sender_id::text || '/%'
  )
);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('broadcast-voice','broadcast-voice',false,10485760,array['audio/webm','audio/mp4','audio/ogg'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "broadcast voice upload" on storage.objects for insert to authenticated
with check (bucket_id='broadcast-voice'
  and (storage.foldername(name))[2]=auth.uid()::text
  and (storage.foldername(name))[1] in (select household_id::text from public.household_members where user_id=auth.uid()));

create policy "broadcast voice household playback" on storage.objects for select to authenticated
using (bucket_id='broadcast-voice'
  and (storage.foldername(name))[1] in (select household_id::text from public.household_members where user_id=auth.uid()));

create policy "broadcast voice uploader cleanup" on storage.objects for delete to authenticated
using (bucket_id='broadcast-voice' and (storage.foldername(name))[2]=auth.uid()::text
  and (storage.foldername(name))[1] in (select household_id::text from public.household_members where user_id=auth.uid()));

notify pgrst, 'reload schema';
