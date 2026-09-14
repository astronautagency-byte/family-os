import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const headers = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info"};
Deno.serve(async request => {
 if(request.method==='OPTIONS') return new Response('ok',{headers});
 if(request.method!=='POST') return new Response('Method not allowed',{status:405,headers});
 try {
  const url=Deno.env.get('SUPABASE_URL')!;
  const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:request.headers.get('Authorization') || ''}}});
  const {data:{user},error}=await client.auth.getUser();
  if(error || !user) return Response.json({error:'Sign in required.'},{status:401,headers});
  if(!Deno.env.get('VAPID_PRIVATE_KEY') || !Deno.env.get('VAPID_PUBLIC_KEY')) throw Error('Web Push is not configured.');
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {endpoint}=await request.json();
  const {data:device,error:deviceError}=await admin.from('push_subscriptions').select('id').eq('user_id',user.id).eq('endpoint',endpoint).single();
  if(deviceError || !device) throw Error('Register this device before sending a test.');
  const {data:recent,error:recentError}=await admin.from('reminder_deliveries').select('id').eq('user_id',user.id).gte('created_at',new Date(Date.now()-60000).toISOString()).limit(1);
  if(recentError) throw recentError;
  if(recent?.length) return Response.json({error:'Wait a minute before sending another test.'},{status:429,headers});
  const {error:queueError}=await admin.from('reminder_deliveries').insert({user_id:user.id,subscription_id:device.id,due_at:new Date(Date.now()+60000).toISOString(),notification:{title:'FamOS reminder test',body:'This test was sent by the server, even if FamOS was closed.',url:'/settings',tag:`famos-test-${crypto.randomUUID()}`}});
  if(queueError) throw queueError;
  return Response.json({queued:true},{headers});
 } catch(error) { return Response.json({error:error instanceof Error ? error.message : 'Could not queue the test.'},{status:400,headers}); }
});
