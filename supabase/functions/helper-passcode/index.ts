import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  if(Number(req.headers.get('Content-Length')||0)>4096)return json({error:'Request too large'},413);
  const raw=await req.text();if(raw.length>4096)return json({error:'Request too large'},413);const b=JSON.parse(raw);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  let r;
  if(b.action==='login'){
   if(!/^[a-f0-9]{64}$/.test(b.token||'')||typeof b.passcode!=='string'||b.passcode.length>64)return json({error:'Invalid invitation or passcode'},400);
   r=await admin.rpc('helper_guest_login',{token:b.token,passcode:b.passcode});
  }else{
   if(!['read','complete','logout'].includes(b.action)||!/^[a-f0-9]{64}$/.test(b.secret||''))return json({error:'Access unavailable'},403);
   r=await admin.rpc('helper_guest_portal',{secret:b.secret,action:b.action,payload:b.payload||{}});
  }
  if(r.error||r.data?.error)return json({error:r.data?.error||'Access unavailable or action not permitted'},403);
  return json(r.data);
 }catch{return json({error:'Could not open helper access. Check your invitation and try again.'},400);}
});
