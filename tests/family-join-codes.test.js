import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='00000000-0000-0000-0000-000000000001', recipient='00000000-0000-0000-0000-000000000002', home='10000000-0000-0000-0000-000000000001';
async function fixture(){
 const db=new PGlite();
 await db.exec(`create schema auth;create role anon;create role authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table public.profiles(id uuid primary key,display_name text);
 create table public.households(id uuid primary key,created_by uuid);
 create table public.household_members(household_id uuid,user_id uuid unique,role text);
 create table public.household_invitations(id uuid primary key default gen_random_uuid(),household_id uuid,email text,invited_by uuid,expires_at timestamptz,accepted_at timestamptz,unique(household_id,email));
 insert into auth.users values('${owner}','owner@example.invalid',now()),('${recipient}','recipient@example.invalid',now());
 insert into public.profiles values('${owner}','Owner'),('${recipient}','Recipient');
 insert into public.households values('${home}','${owner}');
 insert into public.household_members values('${home}','${owner}','owner');`);
 await db.exec(await readFile(new URL('../supabase/migrations/202611240001_family_join_codes.sql',import.meta.url),'utf8'));
 const as=async id=>db.query("select set_config('test.uid',$1,false)",[id]);
 const call=async(action,payload={})=>(await db.query('select public.family_join($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;
 return {db,as,call};
}
test('codes require owner approval, bind invitation to verified email and revoke before membership',async()=>{
 const {db,as,call}=await fixture();try{
 await as(recipient);await assert.rejects(call('create',{household_id:home}),/owner access/);
 await as(owner);const issued=await call('create',{household_id:home});assert.match(issued.code,/^[A-F0-9]{5}-[A-F0-9]{5}$/);
 const stored=(await db.query('select code_hash from public.family_join_codes')).rows[0];assert.ok(!stored.code_hash.includes(issued.code));
 await as(recipient);assert.equal((await call('request',{code:issued.code})).status,'pending');
 assert.equal((await db.query('select count(*)::int n from public.household_members')).rows[0].n,1);
 assert.equal((await call('request',{code:issued.code})).status,'pending');
 await as(owner);const pending=(await call('load',{household_id:home})).requests;assert.equal(pending.length,1);
 await call('approve',{household_id:home,id:pending[0].id});
 assert.equal((await db.query('select email from public.household_invitations')).rows[0].email,'recipient@example.invalid');
 await call('revoke',{household_id:home,id:issued.id});
 assert.equal((await db.query('select expires_at<=now() expired from public.household_invitations')).rows[0].expired,true);
 await as(recipient);assert.match((await call('request',{code:issued.code})).error,/invalid or expired/);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from public.family_join_codes'),/permission denied/);
 }finally{await db.close();}
});
test('expired, replaced and guessed codes fail with bounded persistent attempts',async()=>{
 const {db,as,call}=await fixture();try{
 await as(owner);const first=await call('create',{household_id:home});await call('create',{household_id:home});
 await as(recipient);assert.match((await call('request',{code:first.code})).error,/invalid or expired/);
 for(let i=0;i<10;i++)await call('request',{code:'0000000000'});
 assert.match((await call('request',{code:'0000000000'})).error,/Too many/);
 assert.equal((await call('status')).requests.length,0);
 }finally{await db.close();}
});
