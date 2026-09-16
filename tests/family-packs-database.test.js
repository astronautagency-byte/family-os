import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('Family Packs database permissions, sanitization, atomic imports and revocation',async t=>{
 const db=new PGlite();
 const owner='00000000-0000-4000-8000-000000000001',recipient='00000000-0000-4000-8000-000000000002',child='00000000-0000-4000-8000-000000000003';
 const h1='00000000-0000-4000-8000-000000000011',h2='00000000-0000-4000-8000-000000000012';
 try{
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;
 create table public.profiles(id uuid primary key);
 create table public.households(id uuid primary key);
 create table public.household_members(household_id uuid,user_id uuid,role text);
 create table public.household_feature_preferences(household_id uuid primary key,features jsonb,pause_reminders boolean,updated_at timestamptz);
 create function public.rewardbank_is_parent(h uuid) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.household_members where household_id=h and user_id=auth.uid() and role='owner')$$;
 create table public.task_lists(id uuid primary key default gen_random_uuid(),household_id uuid,name text,created_by uuid);
 create table public.tasks(id uuid primary key default gen_random_uuid(),household_id uuid,title text,created_by uuid,list_id uuid,recurrence text,due_date date,notes text,assignee_id uuid,is_done boolean default false);
 create table public.household_recipes(id uuid primary key default gen_random_uuid(),household_id uuid,created_by uuid,title text,recipe jsonb);
 create table public.meals(id uuid primary key default gen_random_uuid(),household_id uuid,meal_date date,slot text,title text,created_by uuid,recipe_snapshot jsonb,unique(household_id,meal_date,slot));
 insert into public.profiles values('${owner}'),('${recipient}'),('${child}');
 insert into public.households values('${h1}'),('${h2}');
 insert into public.household_members values('${h1}','${owner}','owner'),('${h2}','${recipient}','owner'),('${h1}','${child}','member');`);
 // Match Supabase's default direct role grants, not only PostgreSQL PUBLIC grants.
 await db.exec('alter default privileges in schema public grant execute on functions to anon,authenticated');
 await db.exec(readFileSync(new URL('../supabase/migrations/202609160001_family_packs.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/202609160002_family_pack_function_permissions.sql',import.meta.url),'utf8'));
 const as=async(user,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec(`set role ${role}`);};
 const publish=async p=>(await db.query('select public.publish_family_pack($1,$2) as token',[h1,JSON.stringify(p)])).rows[0].token;
 const preview=async token=>(await db.query('select public.preview_family_pack($1) as pack',[token])).rows[0].pack;
 const importPack=async(token,start=null)=>(await db.query('select public.import_family_pack($1,$2,$3) as result',[token,h2,start])).rows[0].result;
 const count=async table=>{await db.exec('reset role');return Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);};
 await as(owner);
 const token=await publish({kind:'tasks',title:'Weekly reset',household_id:h1,items:[{title:'Wash dishes',assignee_id:child,due_date:'2026-09-16',notes:'Secret address'}]});
 assert.match(token,/^[a-f0-9]{64}$/);
 await t.test('anonymous preview excludes private metadata and does not grant table access',async()=>{
  await as(null,'anon');assert.deepEqual(await preview(token),{version:1,kind:'tasks',title:'Weekly reset',items:[{title:'Wash dishes'}]});
  await assert.rejects(db.query('select * from public.family_packs'),/permission denied/);
  await assert.rejects(db.query('select public.publish_family_pack($1,$2)',[h1,'{}']),/permission denied/);
  await assert.rejects(db.query('select public.import_family_pack($1,$2,null)',[token,h2]),/permission denied/);
  assert.equal(await preview('bad'),null);
 });
 await t.test('children and unrelated owners cannot publish or revoke household packs',async()=>{
  await as(child);await assert.rejects(publish({}),/Only a household owner/);
  await assert.rejects(importPack(token),/Only a household owner/);
  await as(recipient);assert.equal((await db.query('select * from public.family_packs')).rows.length,0);
  await assert.rejects(publish({}),/Only a household owner/);
 });
 await t.test('task copy is independent, unassigned and idempotent',async()=>{
  await as(recipient);assert.equal((await importPack(token)).count,1);assert.equal((await importPack(token)).alreadyImported,true);
  assert.equal(await count('tasks'),1);
  const row=(await db.query('select * from public.tasks')).rows[0];assert.equal(row.household_id,h2);assert.equal(row.assignee_id,null);assert.equal(row.due_date,null);assert.equal(row.notes,'');
 });
 await t.test('recipe imports preserve source and strip photos and notes on the server',async()=>{
  await as(owner);const rt=await publish({kind:'recipes',title:'Dinner',items:[{title:'Pasta',recipe:{ingredients:['Pasta'],instructions:['Cook'],sourceUrl:'https://example.com/pasta',sourceName:'Chef',sourcePhotos:['private'],notes:'secret'}}]});
  await as(recipient);await importPack(rt);await db.exec('reset role');const recipe=(await db.query('select recipe from public.household_recipes')).rows[0].recipe;
  assert.equal(recipe.sourceUrl,'https://example.com/pasta');assert.equal(recipe.sourcePhotos,undefined);assert.equal(recipe.notes,undefined);
 });
 await t.test('meal conflicts roll back every item and the import ledger, allowing retry',async()=>{
  await as(owner);const mt=await publish({kind:'meals',title:'Meals',items:[{title:'Soup',day:0,slot:'lunch'},{title:'Pasta',day:0,slot:'dinner'}]});
  await db.exec('reset role');await db.query("insert into public.meals(household_id,meal_date,slot,title) values($1,current_date,'dinner','Existing')",[h2]);
  const today=(await db.query("select current_date::text as date")).rows[0].date;
  const tomorrow=(await db.query("select (current_date+1)::text as date")).rows[0].date;
  await as(recipient);await assert.rejects(importPack(mt,today),/Nothing was imported/);assert.equal(await count('meals'),1);
  await as(recipient);assert.equal((await importPack(mt,tomorrow)).count,2);assert.equal(await count('meals'),3);
 });
 await t.test('routine import requires an explicit start and retains only approved cadence and steps',async()=>{
  await as(owner);const rt=await publish({kind:'routines',title:'Morning',items:[{title:'Get ready',cadence:'weekdays',steps:['Pack lunch'],assignee_id:child}]});
  await as(recipient);await assert.rejects(importPack(rt),/Choose a start date/);
  const today=(await db.query('select current_date::text as date')).rows[0].date;await importPack(rt,today);
  await db.exec('reset role');const row=(await db.query("select * from public.tasks where title='Get ready'")).rows[0];assert.equal(row.recurrence,'routine:weekdays');assert.equal(row.notes,'Pack lunch');assert.equal(row.assignee_id,null);
 });
 await t.test('invalid server payloads are rejected',async()=>{
  await as(owner);for(const p of [{kind:'other',title:'x',items:[{title:'x'}]},{kind:'tasks',title:'x',items:[]},{kind:'routines',title:'x',items:[{title:'x',cadence:'hourly',steps:[]}]},{kind:'meals',title:'x',items:[{title:'x',day:0,slot:'dinner'},{title:'y',day:0,slot:'dinner'}]},{kind:'recipes',title:'x',items:[{title:'x',recipe:{ingredients:['a'],instructions:['b'],sourceUrl:'https://example.com?token=secret'}}]}])await assert.rejects(publish(p));
 });
 await t.test('feature preferences are enforced server-side without revoking existing links',async()=>{
  await as(owner);await db.query('select public.set_household_features($1,$2,false)',[h1,'{"family_packs":false}']);
  await assert.rejects(publish({kind:'tasks',title:'New',items:[{title:'Tidy'}]}),/Enable Family Packs/);
  await as(null,'anon');assert.ok(await preview(token));
  await as(recipient);await db.query('select public.set_household_features($1,$2,false)',[h2,'{"tasks":false}']);await assert.rejects(importPack(token),/Enable the destination page/);
  await db.query('select public.set_household_features($1,$2,false)',[h2,'{}']);
  await as(owner);await db.query('select public.set_household_features($1,$2,false)',[h1,'{}']);
 });
 await t.test('revocation blocks new preview and import but preserves existing copies',async()=>{
  await as(owner);const id=(await db.query('select id from public.family_packs where token=$1',[token])).rows[0].id;
  await as(recipient);await assert.rejects(db.query('select public.revoke_family_pack($1)',[id]),/not owned/);
  await as(owner);await db.query('select public.revoke_family_pack($1)',[id]);await as(null,'anon');assert.equal(await preview(token),null);
  await as(recipient);await assert.rejects(importPack(token),/unavailable/);assert.equal(await count('tasks'),2);
 });
 await t.test('expiry blocks access; deleting sender does not delete imported copies',async()=>{
  await as(owner);const expiring=await publish({kind:'tasks',title:'Expires',items:[{title:'Tidy'}]});await as(null,'anon');assert.ok(await preview(expiring));
  await db.exec('reset role');await db.exec("update public.family_packs set expires_at=now()-interval '1 day'");await as(null,'anon');assert.equal(await preview(expiring),null);
  await db.exec('reset role');await db.query('delete from public.households where id=$1',[h1]);assert.equal(await count('household_recipes'),1);assert.equal(await count('tasks'),2);
 });
 } finally {await db.close();}
});
