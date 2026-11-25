import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('ad delivery omits private campaign fields and internal billing helpers reject direct client calls',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
  create table public.ad_partners(id uuid primary key,status text);create table public.household_members(user_id uuid,household_id uuid);create table public.household_profiles(household_id uuid,family_size integer,country text,region text,city text,postal_code text);create function public.household_has_paid_subscription(target_household uuid) returns boolean language sql as $$select false$$;`);
  const original=await readFile(new URL('../supabase/migrations/202608170003_ad_network.sql',import.meta.url),'utf8');
  await db.exec(original.match(/create table if not exists public\.ad_campaigns \([\s\S]*?\n\);/)[0]);
  await db.exec(`insert into public.household_members values(auth.uid(),'10000000-0000-0000-0000-000000000001');insert into public.household_profiles(household_id) values('10000000-0000-0000-0000-000000000001');insert into public.ad_partners values('20000000-0000-0000-0000-000000000001','active');insert into public.ad_campaigns(partner_id,name,status,headline,cta_url,budget_cents) values('20000000-0000-0000-0000-000000000001','Private campaign name','active','Public headline','https://example.com',9000);`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611250002_ad_creative_projection.sql',import.meta.url),'utf8'));
  await db.exec('set role authenticated');
  const data=(await db.query("select public.get_my_ads('calendar') value")).rows[0].value;
  assert.equal(data.ads.length,1);assert.deepEqual(Object.keys(data.ads[0]).sort(),['body_text','cta_text','cta_url','headline','id','image_url']);
  await assert.rejects(db.query("select public.household_has_paid_subscription('10000000-0000-0000-0000-000000000001')"),/permission denied/);
  await db.exec('set role anon');await assert.rejects(db.query("select public.get_my_ads('calendar')"),/permission denied/);
 }finally{await db.close();}
});
