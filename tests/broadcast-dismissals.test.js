import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('broadcast dismissals persist per recipient without changing messages',async()=>{
 const db=new PGlite();
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',m='00000000-0000-4000-8000-000000000003';
 try{
 await db.exec(`create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select current_setting('request.jwt.claim.sub')::uuid$$;
 grant usage on schema auth to authenticated;
 create table public.messages(id uuid primary key,household_id int);
 grant select on public.messages to authenticated;
 create function public.is_household_member(h int) returns boolean language sql as $$select h=1$$;
 insert into auth.users values('${a}'),('${b}');insert into messages values('${m}',1);`);
 await db.exec(readFileSync(new URL('../supabase/migrations/202609240002_broadcast_dismissals.sql',import.meta.url),'utf8'));
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${a}';insert into broadcast_dismissals(user_id,message_id) values('${a}','${m}');`);
 assert.equal((await db.query('select * from broadcast_dismissals')).rows.length,1);
 await db.exec(`set request.jwt.claim.sub='${b}'`);
 assert.equal((await db.query('select * from broadcast_dismissals')).rows.length,0);
 await assert.rejects(db.exec(`insert into broadcast_dismissals(user_id,message_id) values('${a}','${m}')`),/row-level security/);
 await db.exec(`set request.jwt.claim.sub='${a}'`);
 assert.equal((await db.query('select * from broadcast_dismissals')).rows.length,1);
 assert.equal((await db.query('select * from messages')).rows.length,1);
 }finally{await db.close();}
});
