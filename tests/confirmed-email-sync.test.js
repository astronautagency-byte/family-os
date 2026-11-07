import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('profile email changes only when the auth email is confirmed', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth;
      create table auth.users (id uuid primary key, email text, email_change text);
      create table public.profiles (id uuid primary key, email text not null, updated_at timestamptz default now());
      insert into auth.users values ('00000000-0000-0000-0000-000000000001', 'old@example.test', null);
      insert into public.profiles (id, email) values ('00000000-0000-0000-0000-000000000001', 'old@example.test');`);
    await db.exec(await readFile(new URL('../supabase/migrations/202611070003_sync_confirmed_profile_email.sql', import.meta.url), 'utf8'));
    await db.exec("update auth.users set email_change = 'new@example.test'");
    assert.equal((await db.query('select email from public.profiles')).rows[0].email, 'old@example.test');
    await db.exec("update auth.users set email = email_change, email_change = null");
    assert.equal((await db.query('select email from public.profiles')).rows[0].email, 'new@example.test');
  } finally {
    await db.close();
  }
});
