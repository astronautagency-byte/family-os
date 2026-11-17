import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { downloadGroceryPhoto } from '../src/lib/groceryPhotoUpload.js';

const ownHome = '10000000-0000-4000-8000-000000000001';
const otherHome = '10000000-0000-4000-8000-000000000002';

test('attachment rules block anonymous and other-household reads and client support uploads', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema storage;
      create table storage.buckets(id text, public boolean);
      create table storage.objects(bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select, insert on storage.objects to anon, authenticated;
      create function storage.foldername(name text) returns text[] language sql as
      $$ select string_to_array(name, '/') $$;
      create function public.is_household_member(home uuid) returns boolean language sql as
      $$ select home::text = current_setting('test.home', true) $$;
      create policy "legacy permissive policy" on storage.objects for all using (true) with check (true);
      insert into storage.buckets values ('grocery-photos', true), ('support-screenshots', true), ('broadcast-voice', false);
      insert into storage.objects values ('grocery-photos', '${ownHome}/own.jpg'),
        ('grocery-photos', '${otherHome}/other.jpg'), ('support-screenshots', 'support.png');
    `);
    for (const migration of ['001_private_support_screenshots', '002_grocery_photo_access', '003_private_grocery_photo_bucket']) {
      await db.exec(await readFile(new URL(`../supabase/migrations/202611160${migration}.sql`, import.meta.url), 'utf8'));
    }
    const { rows: buckets } = await db.query('select public from storage.buckets');
    assert.ok(buckets.every(bucket => !bucket.public));
    const visible = () => db.query('select name from storage.objects').then(result => result.rows.map(row => row.name));
    await db.exec('set role anon');
    assert.deepEqual(await visible(), []);
    await db.exec(`set role authenticated; set test.home = '${ownHome}'`);
    assert.deepEqual(await visible(), [`${ownHome}/own.jpg`]);
    await assert.rejects(db.query("insert into storage.objects values ('support-screenshots', 'new.png')"), /row-level security/);
    await db.exec("set test.home = ''");
    assert.deepEqual(await visible(), []);
  } finally {
    await db.close();
  }
});

test('legacy photo references use authenticated downloads without reusing a cached file', async () => {
  const path = `${ownHome}/own.jpg`;
  const reference = `https://example.supabase.co/storage/v1/object/public/grocery-photos/${path}`;
  const signal = new AbortController().signal;
  const blob = new Blob(['sample']);
  const supabase = { storage: { from(bucket) {
    assert.equal(bucket, 'grocery-photos');
    return { async download(key, _options, fetchOptions) {
      assert.equal(key, path);
      assert.deepEqual(fetchOptions, { signal, cache: 'no-store' });
      return { data: blob };
    } };
  } } };
  assert.equal(await downloadGroceryPhoto(reference, supabase, signal), blob);
  assert.equal(await downloadGroceryPhoto('https://example.com/other.jpg', supabase, signal), null);
});
