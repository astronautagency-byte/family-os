import test from 'node:test';import assert from 'node:assert/strict';
import {requestAiChat} from '../supabase/functions/_shared/aiChat.js';
const providers=[{name:'groq',url:'https://groq.invalid',key:'synthetic',model:'openai/gpt-oss-20b'},{name:'xai',url:'https://xai.invalid',key:'synthetic',model:'configured-model'}];
test('caps Groq output and reasoning while preserving tool proposals and a request deadline',async()=>{
 let body,signal;
 const response=await requestAiChat({providers,messages:[],tools:[{type:'function'}],fetchImpl:async(_,init)=>{body=JSON.parse(init.body);signal=init.signal;return new Response('{}');}});
 assert.equal(response.status,200);assert.equal(body.max_completion_tokens,2048);assert.equal(body.reasoning_effort,'low');assert.equal(body.tool_choice,'auto');assert.equal(signal.aborted,false);
});
test('network failure uses the bounded AI backup without echoing request content',async()=>{
 let calls=0,body;
 const response=await requestAiChat({providers,messages:[{role:'user',content:'synthetic request'}],tools:[],fetchImpl:async(_,init)=>{calls++;if(calls===1)throw Error('private provider diagnostic');body=JSON.parse(init.body);return new Response('{}');}});
 assert.equal(response.status,200);assert.equal(calls,2);assert.equal(body.max_tokens,1024);assert.equal(body.tools,undefined);
});

test('AI endpoint distinguishes a temporary provider outage without revealing provider bodies',async()=>{
 const fs=await import('node:fs');const vm=await import('node:vm');const {stripTypeScriptTypes}=await import('node:module');
 const {minimalAiContext,minimalAiMessages}=await import('../supabase/functions/_shared/aiContext.js');
 for(const upstream of [null,new Response('private upstream response',{status:500})]){
  let handler;
  vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/fam-ai/index.ts','utf8').replace(/^import .*;$/gm,'')),{
   Deno:{env:{get:()=> 'synthetic'},serve:fn=>handler=fn},
   aiPrivacyDenial:async()=>null,createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'synthetic'}}})}}),consumeUsage:async()=>({allowed:true}),minimalAiContext,minimalAiMessages,
   requestAiChat:async()=>upstream,Request,Response,console:{error(){},warn(){}},crypto,
  });
  const result=await handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Add 3 lemons to my shopping list.'}]})}));
  const body=await result.json();assert.equal(result.status,503);assert.equal(body.code,upstream?'AI_UPSTREAM_500':'AI_REQUEST_TIMEOUT');assert.equal(JSON.stringify(body).includes('private upstream'),false);assert.equal(result.headers.get('cache-control'),'no-store');
 }
});
