import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

test('message edits require the author and preserve identity and channel', async () => {
 const db = new PGlite();
 const user = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 try {
  await db.exec(`create role authenticated; create schema auth;
   create function auth.uid() returns uuid language sql as $$select current_setting('request.jwt.claim.sub')::uuid$$;
   grant usage on schema auth to authenticated;
   create table public.messages(id int primary key, household_id int, sender_id uuid, recipient_id uuid, body text);
   alter table public.messages enable row level security;
   grant select,insert,update,delete on public.messages to authenticated;
   create function public.has_household_feature(h int,f text) returns boolean language sql as $$select true$$;
   create function public.is_household_member(h int) returns boolean language sql as $$select h=1 and auth.uid() <> '${user(9)}'::uuid$$;
   create function public.shares_household(u uuid) returns boolean language sql as $$select true$$;
   insert into messages values(1,1,'${user(1)}',null,'Shared'),(2,1,'${user(1)}','${user(2)}','Private');`);
  const legacy = fs.readFileSync('supabase/migrations/202608150006_chargebee_feature_billing.sql','utf8');
  await db.exec(legacy.slice(legacy.indexOf('create policy "entitled direct messages read"'),legacy.indexOf("select pg_notify")));
  await db.exec(fs.readFileSync('supabase/migrations/202611070001_message_update_security.sql','utf8'));
  const actAs = async n => db.exec(`set role authenticated; set request.jwt.claim.sub='${user(n)}'`);
  for (const n of [2,3,9]) {
   await actAs(n);
   assert.equal((await db.query("update messages set body='Forged' returning id")).rows.length,0);
   assert.equal((await db.query(`update messages set sender_id='${user(n)}' returning id`)).rows.length,0);
  }
  await actAs(1);
  assert.equal((await db.query("update messages set body='Edited' where id=1 returning body")).rows[0].body,'Edited');
  for (const change of [`sender_id='${user(2)}'`, 'household_id=2', `recipient_id='${user(3)}'`]) {
   await assert.rejects(db.query(`update messages set ${change} where id=1`), /Message author and channel cannot be changed/);
  }
  await assert.rejects(db.query('update messages set recipient_id=null where id=2'), /Message author and channel cannot be changed/);
  await db.exec('reset role; create policy "accidental broad update" on messages for update to authenticated using(true) with check(true)');
  await actAs(2);
  assert.equal((await db.query("update messages set body='Forged again' returning id")).rows.length,0);
 } finally { await db.close(); }
});
