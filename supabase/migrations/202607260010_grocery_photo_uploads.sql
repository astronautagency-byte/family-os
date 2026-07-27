-- ─────────────────────────────────────────────────────────────────────
-- Grocery photos
-- Let family members snap or upload a photo of an item they're shopping
-- for (e.g. "this exact loaf of bread", "the brand of milk we like")
-- and pin it to the grocery row. Photos are private to the household
-- via a public bucket whose path is namespaced by household_id, plus
-- INSERT/DELETE RLS that requires household_members membership.
--
-- The read path is intentionally wide-open: storage object paths are
-- random UUIDs under household-scoped folders, so a public bucket
-- doesn't leak anything enumerable. This keeps the realtime read path
-- a plain URL string we can write into photo_url — no signed URL
-- rotation, no fetch round-trip per render.
-- ─────────────────────────────────────────────────────────────────────

alter table public.grocery_items
  add column if not exists photo_url text not null default '',
  add column if not exists photo_uploaded_by uuid,
  add column if not exists photo_uploaded_at timestamptz;

create index if not exists grocery_items_photo_idx
  on public.grocery_items (household_id)
  where photo_url is not null and photo_url <> '';

-- Bucket: private-ish. Path namespacing + UUID keys handle access
-- privacy for reads. INSERT/DELETE still require authed household membership
-- so the bucket itself can't be polluted by anonymous uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'grocery-photos',
  'grocery-photos',
  true,
  10485760, -- 10MB raw — client compresses to ~150-300KB JPEG before upload
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- INSERT into {household_id}/... requires the uploader to be in that
-- household. The foldername[1] lookup is the Supabase-canonical pattern
-- for scoping object writes to a column on a related table.
drop policy if exists "household_grocery_photos_upload" on storage.objects;
create policy "household_grocery_photos_upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'grocery-photos'
    and (storage.foldername(name))[1]::uuid in (
      select household_id from public.household_members
      where user_id = auth.uid()
    )
  );

-- UPDATE: only allow rewriting a file you own (used for overwriting on
-- the same path; not currently exercised but kept so future tooling can
-- safely retry with upsert).
drop policy if exists "household_grocery_photos_update" on storage.objects;
create policy "household_grocery_photos_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'grocery-photos'
    and owner = auth.uid()
  )
  with check (
    bucket_id = 'grocery-photos'
    and owner = auth.uid()
  );

-- DELETE: any household member can remove an item's photo (the row
-- itself is removable by anyone in the household today, so this matches
-- the existing model).
drop policy if exists "household_grocery_photos_delete" on storage.objects;
create policy "household_grocery_photos_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'grocery-photos'
    and (storage.foldername(name))[1]::uuid in (
      select household_id from public.household_members
      where user_id = auth.uid()
    )
  );

-- Realtime: publish the grocery_items column changes so the photo
-- thumbnail pops onto sibling devices the instant it's uploaded. The
-- existing toast for grocery inserts already covers the row; ALTER
-- REPLICA IDENTITY FULL gives UPDATE event diffs (the older default
-- only emitted NEW rows) — without this, an in-place photo swap from
-- another device doesn't fire a postgres_changes UPDATE event with
-- old_image_url so siblings would keep the stale thumbnail.
alter table public.grocery_items replica identity full;

notify pgrst, 'reload schema';
