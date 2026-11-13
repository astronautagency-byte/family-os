import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('account deletion scopes uploads to the user and owned households', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-0000-0000-000000000001';
  const member = '00000000-0000-0000-0000-000000000002';
  const home = '00000000-0000-0000-0000-000000000003';
  const otherHome = '00000000-0000-0000-0000-000000000004';
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create schema storage;
      create function auth.uid() returns uuid language sql as
      $$ select nullif(current_setting('test.account_id', true), '')::uuid $$;
      create table public.households(id uuid, created_by uuid);
      create table storage.objects(bucket_id text, name text, owner_id text);
      create table deleted_accounts(id uuid);
      create function public.delete_own_account() returns void language sql as
      $$ insert into public.deleted_accounts values (auth.uid()) $$;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/202611120001_account_upload_cleanup.sql', import.meta.url), 'utf8'));
    await db.exec(`
      insert into public.households values ('${home}', '${owner}'), ('${otherHome}', '${member}');
      insert into storage.objects values
        ('grocery-photos', '${home}/owner.png', '${owner}'),
        ('grocery-photos', '${home}/member.png', '${member}'),
        ('grocery-photos', '${otherHome}/other.png', '${member}'),
        ('support-screenshots', '${owner}/support.png', null),
        ('broadcast-voice', '${home}/${owner}/recording', null),
        ('ad-creatives', 'unrelated.png', '${owner}');
      set test.account_id = '${owner}';
    `);
    const { rows } = await db.query('select object_name from public.account_upload_cleanup_batch($1)', [owner]);
    assert.deepEqual(rows.map(row => row.object_name), [
      `${home}/${owner}/recording`, `${home}/member.png`, `${home}/owner.png`, `${owner}/support.png`,
    ]);
    const grants = await db.query(`select
      has_function_privilege('authenticated','public.account_upload_cleanup_batch(uuid)','execute') as batch,
      has_function_privilege('authenticated','public.delete_own_account_records()','execute') as direct`);
    assert.deepEqual(grants.rows, [{ batch: false, direct: false }]);
    await assert.rejects(db.query('select public.delete_own_account()'), /Update FamOS/);
    await db.exec(`
      delete from storage.objects as object using public.account_upload_cleanup_batch('${owner}') as selected
      where object.bucket_id=selected.bucket_id and object.name=selected.object_name;
      select public.delete_own_account();
    `);
    assert.deepEqual((await db.query('select id from deleted_accounts')).rows, [{ id: owner }]);
    assert.equal((await db.query('select count(*)::int as total from storage.objects')).rows[0].total, 2);
  } finally {
    await db.close();
  }
});
