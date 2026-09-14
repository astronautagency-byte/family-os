import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {reminderPaused} from "../_shared/feature-reminders.js";
import webpush from "npm:web-push@3.6.7";
Deno.serve(async request => {
 const secret=Deno.env.get('REMINDER_CRON_SECRET');
 if(!secret || request.headers.get('x-reminder-secret')!==secret) return new Response('Unauthorized',{status:401});
 if(request.method!=='POST') return new Response('Method not allowed',{status:405});
 try {
  const publicKey=Deno.env.get('VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('VAPID_PRIVATE_KEY');
  if(!publicKey || !privateKey) throw Error('Web Push is not configured.');
  webpush.setVapidDetails('mailto:support@fam-os.app',publicKey,privateKey);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Exhausted jobs from crashed workers must not remain processing forever.
  const {error:cleanupError}=await admin.from('reminder_deliveries').update({status:'failed',last_error:'Delivery attempts exhausted'}).eq('status','processing').gte('attempts',3).lt('locked_until',new Date().toISOString());
  if(cleanupError) throw cleanupError;
  const {data:jobs,error}=await admin.rpc('claim_reminder_deliveries');
  if(error) throw error;
  let accepted=0;
  for(const job of jobs || []) {
   const update=async (values:Record<string,unknown>)=>{
    const {error}=await admin.from('reminder_deliveries').update(values).eq('id',job.id).eq('claim_token',job.claim_token);
    if(error) throw error;
   };
   let outcome;
   try {
    const {data:memberships,error:membershipError}=await admin.from("household_members").select("household_id").eq("user_id",job.user_id);
    if(membershipError)throw membershipError;
    const householdIds=(memberships || []).map(m=>m.household_id);
    if(householdIds.length){
     const {data:preferences,error:preferencesError}=await admin.from("household_feature_preferences").select("features,pause_reminders").in("household_id",householdIds);
     if(preferencesError)throw preferencesError;
     if((preferences || []).some(p=>reminderPaused(p,job.notification))){await update({status:"skipped",locked_until:null,last_error:"Paused by household layout"});continue;}
    }
    const {data:device,error:deviceError}=await admin.from('push_subscriptions').select('subscription').eq('id',job.subscription_id).eq('user_id',job.user_id).single();
    if(deviceError || !device) throw Object.assign(Error('Device registration missing'),{statusCode:410});
    await webpush.sendNotification(device.subscription,JSON.stringify(job.notification),{TTL:3600,urgency:'normal',timeout:10000});
    accepted++;
    outcome={status:'accepted',locked_until:null,last_error:null};
   } catch(error) {
    const statusCode=error && typeof error==='object' && 'statusCode' in error ? Number(error.statusCode) : 0;
    const expired=[404,410].includes(statusCode);
    if(expired) {
     const {error:deleteError}=await admin.from('push_subscriptions').delete().eq('id',job.subscription_id).eq('user_id',job.user_id);
     if(deleteError) throw deleteError;
    }
    outcome={status:expired || job.attempts>=3?'failed':'pending',locked_until:null,last_error:expired?'Device registration expired':`Push rejected (${statusCode || 'network'})`,due_at:new Date(Date.now()+60000*2**job.attempts).toISOString()};
   }
   await update(outcome);
  }
  return Response.json({processed:jobs?.length || 0,accepted});
 } catch(error) { console.error('Reminder worker failed',error instanceof Error ? error.message : 'Unknown error');return Response.json({error:'Reminder processing failed'},{status:500}); }
});
