import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('family locations are opt-in, household-scoped, expiring and removable by their owner', async () => {
  const db = new PGlite();
  const one='00000000-0000-0000-0000-000000000001', two='00000000-0000-0000-0000-000000000002', outsider='00000000-0000-0000-0000-000000000003', home='10000000-0000-0000-0000-000000000001';
  try {
    await db.exec(`create schema auth; create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create table auth.users(id uuid primary key);
      create table public.households(id uuid primary key);
      create table public.household_members(household_id uuid, user_id uuid);
      create table public.household_feature_preferences(household_id uuid primary key,features jsonb,pause_reminders boolean,updated_at timestamptz default now());
      create function public.is_household_member(h uuid) returns boolean language sql stable as $$ select exists(select 1 from public.household_members where household_id=h and user_id=auth.uid()) $$;
      create function public.rewardbank_is_parent(h uuid) returns boolean language sql stable as $$ select true $$;
      insert into auth.users values ('${one}'),('${two}'),('${outsider}');
      insert into public.households values ('${home}');
      insert into public.household_members values ('${home}','${one}'),('${home}','${two}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/202611070004_family_location.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query("select has_table_privilege('authenticated','public.family_locations','select') as allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select has_table_privilege('authenticated','public.family_checkins','select') as allowed")).rows[0].allowed,false);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from public.family_locations'), /permission denied/i);
    await db.exec('reset role');
    await db.exec(`select set_config('test.uid','${one}',false); select public.share_family_location('${home}',43.5,-80.5,20)`);
    await db.exec(`select set_config('test.uid','${two}',false)`);
    assert.equal((await db.query(`select * from public.get_family_locations('${home}')`)).rows.length,1);
    await db.exec(`select public.send_family_checkin('${home}')`);
    assert.equal((await db.query(`select * from public.get_family_checkins('${home}')`)).rows.length,1);
    await db.exec(`select public.stop_family_location('${home}')`);
    assert.equal((await db.query(`select * from public.get_family_locations('${home}')`)).rows.length,1);
    await db.exec(`select set_config('test.uid','${outsider}',false)`);
    await assert.rejects(db.query(`select * from public.get_family_locations('${home}')`), /membership required/i);
    await assert.rejects(db.query(`select * from public.get_family_checkins('${home}')`), /membership required/i);
    await assert.rejects(db.query(`select public.send_family_checkin('${home}')`), /membership required/i);
    await assert.rejects(db.query(`select public.share_family_location('${home}',43,-80,10)`), /membership required/i);
    await db.exec(`select set_config('test.uid','${one}',false); select public.stop_family_location('${home}')`);
    assert.equal((await db.query(`select * from public.get_family_locations('${home}')`)).rows.length,0);
    await assert.rejects(db.query(`select public.share_family_location('${home}',95,0,1)`), /Invalid location/);
    await db.exec(`select public.share_family_location('${home}',43,-80,5); update public.family_locations set expires_at=now()-interval '1 minute'`);
    assert.equal((await db.query(`select * from public.get_family_locations('${home}')`)).rows.length,0);
    await db.exec(`insert into public.household_feature_preferences(household_id,features) values ('${home}','{"location":false}')`);
    await assert.rejects(db.query(`select * from public.get_family_locations('${home}')`), /disabled/i);
    await assert.rejects(db.query(`select public.send_family_checkin('${home}')`), /disabled/i);
    await db.exec(`select public.stop_family_location('${home}')`);
  } finally { await db.close(); }
});
