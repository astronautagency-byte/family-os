import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('live voice serialises household sessions, meters elapsed time and protects its ledger',async()=>{
 const db=new PGlite();const user='00000000-0000-0000-0000-000000000001',home='10000000-0000-0000-0000-000000000001';
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function public.ai_privacy_choices(action text) returns jsonb language sql as $$select '{\"accepted\":true}'::jsonb$$;create table public.profiles(id uuid primary key);create table public.households(id uuid primary key);create table public.household_members(user_id uuid,household_id uuid);insert into public.profiles values('${user}');insert into public.households values('${home}');insert into public.household_members values('${user}','${home}');`);
 await db.exec(await readFile(new URL('../supabase/migrations/202611240002_mia_live_session_budget.sql',import.meta.url),'utf8'));
 const reserve=async()=>(await db.query('select public.reserve_mia_live_session($1,$2) result',[user,home])).rows[0].result;
 await db.exec(`insert into auth.users values('${user}');create or replace function auth.uid() returns uuid language sql as $$select '${user}'::uuid$$;`);
 const privacy=async(action,streaming=false)=>(await db.query('select public.mia_live_privacy($1,$2) result',[action,streaming])).rows[0].result;
 assert.equal((await privacy('status')).accepted,false);
 await assert.rejects(privacy('accept'),/live audio consent required/);
 assert.equal((await privacy('accept',true)).accepted,true);
 assert.equal((await privacy('withdraw')).accepted,false);
 assert.equal((await privacy('status')).accepted,false);
 await db.exec(`create or replace function public.ai_privacy_choices(action text) returns jsonb language sql as $$select '{"accepted":false}'::jsonb$$;`);
 await assert.rejects(privacy('accept',true),/Adult AI permission/);
 const first=await reserve();assert.equal(first.seconds,180);assert.match((await reserve()).error,/already active/);
 const consume=async()=>(await db.query('select public.consume_mia_live_text($1) result',[first.id])).rows[0].result;
 for(let i=0;i<12;i++)assert.equal(await consume(),true);
 assert.equal(await consume(),false);
 assert.equal(await db.query('select text_requests from public.mia_live_sessions').then(r=>r.rows[0].text_requests),12);
 await db.exec("update public.mia_live_sessions set ended_at=started_at+interval '30 seconds'");
 const second=await reserve();assert.equal(second.seconds,150);
 assert.equal((await db.query('select public.consume_mia_live_text($1) result',[second.id])).rows[0].result,false,'text allowance is shared across sessions');
 await db.exec("update public.mia_live_sessions set ended_at=expires_at");
 assert.match((await reserve()).error,/preview is used/);
 await db.exec('set role authenticated');await assert.rejects(reserve(),/permission denied/);await assert.rejects(db.query('select * from public.mia_live_sessions'),/permission denied/);
 }finally{await db.close();}
});
