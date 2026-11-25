import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {PGlite} from '@electric-sql/pglite';

test('helper pause revokes all client and edge RPC paths while preserving rows and family joining',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create table public.household_helper_access(id integer);insert into public.household_helper_access values(1);create function public.family_join() returns integer language sql as $$select 1$$;grant execute on function public.family_join() to authenticated;`);
  const names=['family_helpers','helper_portal','helper_resource_catalog','helper_shared_resources','invite_helper_passcode','helper_guest_login','helper_guest_portal','claim_helper_sms'];
  for(const name of names)await db.exec(`create function public.${name}() returns integer language sql as $$select 1$$;grant execute on function public.${name}() to anon,authenticated,service_role;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611250001_pause_family_helpers.sql',import.meta.url),'utf8'));
  for(const role of ['anon','authenticated','service_role'])for(const name of names){
   assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,'public.'+name+'()'])).rows[0].allowed,false,`${role} cannot call ${name}`);
  }
  assert.equal((await db.query('select count(*)::int n from public.household_helper_access')).rows[0].n,1);
  await db.exec('set role authenticated');assert.equal((await db.query('select public.family_join() n')).rows[0].n,1);
 }finally{await db.close();}
});

for(const name of ['helper-passcode','send-helper-invitation'])test(`${name} refuses calls before reading data or sending messages`,async()=>{
 let handler;
 const source=(await readFile(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
 vm.runInNewContext(stripTypeScriptTypes(source),{Deno:{serve:fn=>handler=fn},Response});
 const response=await handler(new Request('https://example.test',{method:'POST',body:'{}'}));
 assert.equal(response.status,503);assert.equal((await response.json()).code,'HELPERS_PAUSED');
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});
