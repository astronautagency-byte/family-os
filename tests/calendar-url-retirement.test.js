// Local-only proof: fetch is intercepted; NO requests reach these addresses.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
const source = fs.readFileSync('supabase/functions/calendar-sync/index.ts','utf8').replace(/^import .*;$/gm,'');
let handler; let fetched;
const db = { select(){return this}, eq(){return this}, limit(){return this}, async maybeSingle(){return {data:{household_id:'synthetic-household'}}} };
vm.runInNewContext(stripTypeScriptTypes(source),{
 Deno:{env:{get:()=> 'synthetic'},serve:fn=>handler=fn},
 createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'synthetic-user'}}})},from:()=>db}),
 Response,URLSearchParams,AbortSignal,console,
 fetch:async(url)=>{fetched=String(url);return new Response('no events');},
});
for(const target of ['http://127.0.0.1:8080/','http://169.254.169.254/','https://internal.example.test/']){
 fetched=null;
 const response=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({action:'import_ical',feed_url:target})}));
 assert.equal(fetched,null, 'Retired URL importer must not fetch any destination');
 assert.equal(response.status,410);
 console.log(JSON.stringify({target,reachedFetch:fetched===target,status:response.status,network:'mocked only'}));
}
