import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {aiPrivacyDenial} from '../_shared/aiPrivacy.ts';
import {authenticatedHousehold} from '../_shared/usage.ts';

const model='grok-voice-3.0';
const headers={'Content-Type':'application/json','Cache-Control':'private, no-store'};
Deno.serve(request=>{
 if(request.headers.get('upgrade')?.toLowerCase()!=='websocket') return new Response(JSON.stringify({error:'Live connection required.'}),{status:426,headers});
 const {socket:client,response}=Deno.upgradeWebSocket(request);
 let upstream:WebSocket|null=null,phase='auth',sessionId:string|null=null,admin:any=null;
 let durationTimer:number|undefined,privacyTimer:number|undefined;
 const calls=new Set<string>(),audioItems=new Set<string>();
 let activeResponse=false;
 const chargeText=async()=>{const result=await admin.rpc('consume_mia_live_text',{target_session:sessionId});if(phase!=='ready' || upstream?.readyState!==WebSocket.OPEN)return false;if(result.error || !result.data){send({type:'mia.error',message:'Your live preview action limit is used. You can type instead.'});finish();return false;}return true;};
 const send=(value:unknown)=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(value));};
 const finish=()=>{
  if(phase==='closed')return;
  phase='closed';clearTimeout(authTimer);clearTimeout(durationTimer);clearInterval(privacyTimer);
  try{upstream?.close();}catch{}
  try{client.close();}catch{}
  if(sessionId && admin) EdgeRuntime.waitUntil(admin.from('mia_live_sessions').update({ended_at:new Date().toISOString()}).eq('id',sessionId).then(()=>{}));
 };
 const authTimer=setTimeout(()=>{send({type:'mia.error',message:'Sign in to start live voice.'});finish();},8000);
 client.onclose=finish;client.onerror=finish;
 client.onmessage=async message=>{
  if(typeof message.data!=='string' || message.data.length>65536){finish();return;}
  let event:any;try{event=JSON.parse(message.data);}catch{finish();return;}
  if(phase==='auth'){
   phase='connecting';clearTimeout(authTimer);
   try{
    if(event.type!=='auth' || typeof event.token!=='string')throw new Error('Sign in to start live voice.');
    const authRequest=new Request(request.url,{headers:{Authorization:`Bearer ${event.token}`}});
    const denial=await aiPrivacyDenial(authRequest,headers);
    if(denial)throw new Error((await denial.json()).error);
    const account=await authenticatedHousehold(authRequest);admin=account.admin;
    const consent=await admin.from('mia_live_privacy_choices').select('withdrawn_at').eq('user_id',account.user.id).maybeSingle();
    if(consent.error || !consent.data || consent.data.withdrawn_at)throw new Error('Review the live audio privacy choice before starting.');
    const budget=await admin.rpc('reserve_mia_live_session',{target_user:account.user.id,target_household:account.householdId});
    if(budget.error || budget.data?.error)throw new Error(budget.data?.error || 'Live voice usage could not be verified.');
    sessionId=budget.data.id;
    if(phase==='closed'){await admin.from('mia_live_sessions').update({ended_at:new Date().toISOString()}).eq('id',sessionId);return;}
    durationTimer=setTimeout(()=>{send({type:'mia.error',message:'Your live voice preview has ended. You can type or return later.'});finish();},budget.data.seconds*1000);
    const key=Deno.env.get('XAI_API_KEY');if(!key)throw new Error('Live voice is temporarily unavailable.');
    const secretResponse=await fetch('https://api.x.ai/v1/realtime/client_secrets',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({expires_after:{seconds:60}}),signal:AbortSignal.timeout(10000)});
    if(!secretResponse.ok)throw new Error('Live voice is temporarily unavailable.');
    const secret=await secretResponse.json();
    if(phase==='closed')return;
    upstream=new WebSocket(`wss://api.x.ai/v1/realtime?model=${model}`,[`xai-client-secret.${secret.value}`]);
    upstream.onopen=()=>{
     if(phase==='closed'){upstream?.close();return;}
     upstream!.send(JSON.stringify({type:'session.update',session:{voice:'eve',instructions:`You are Mia, a friendly, energetic AI home assistant. Speak briefly and naturally with varied intonation. The user's local date is ${String(event.localDate||'').slice(0,10)}. Ask a short clarification when an event date or AM/PM is unclear. You can propose one grocery, task, meal or family event at a time using prepare_addition. Ask permission before saving. Only the app can save. Never say anything was saved unless the app reports success. Explain unsupported actions clearly. Never mention providers, tools or internal implementation. Do not request private information about children.`,turn_detection:{type:'server_vad'},audio:{input:{format:{type:'audio/pcm',rate:24000}},output:{format:{type:'audio/pcm',rate:24000},speed:1.12}},tools:[{type:'function',name:'prepare_addition',description:'Prepare one household addition for user review. This does not save it.',parameters:{type:'object',properties:{type:{type:'string',enum:['add_grocery','add_task','plan_meal','add_event']},args:{type:'object',properties:{name:{type:'string'},title:{type:'string'},quantity:{type:'number'},unit:{type:'string'},due_date:{type:'string'},date:{type:'string'},slot:{type:'string',enum:['breakfast','lunch','dinner']},location:{type:'string'}},additionalProperties:false}},required:['type','args'],additionalProperties:false}}]}}));
    };
    upstream.onmessage=message=>{
     if(typeof message.data!=='string' || message.data.length>524288){finish();return;}
     let received:any;try{received=JSON.parse(message.data);}catch{return;}
     if(received.type==='session.updated'){phase='ready';send({type:'mia.ready',seconds:budget.data.seconds});return;}
     if(received.type==='response.created')activeResponse=true;
     if(received.type==='response.done')activeResponse=false;
     if(['response.audio.delta','response.output_audio.delta'].includes(received.type) && received.item_id)audioItems.add(received.item_id);
     if(received.type==='response.function_call_arguments.done' && received.name==='prepare_addition')calls.add(received.call_id);
     if(received.type==='error' && received.error?.code==='response_cancel_not_active')return;
     if(received.type==='error'){console.warn('Mia live upstream error',String(received.error?.code || 'unknown').replace(/[^a-zA-Z_.-]/g,'').slice(0,80));send({type:'mia.error',message:'Live voice could not continue. Please reconnect.'});finish();return;}
     send(received);
    };
    upstream.onclose=()=>{send({type:'mia.closed'});finish();};upstream.onerror=()=>{send({type:'mia.error',message:'Live voice could not connect. Please try again.'});finish();};
    privacyTimer=setInterval(async()=>{
     try{
      const denied=await aiPrivacyDenial(authRequest,headers);
      const membership=await admin.from('household_members').select('user_id').eq('household_id',account.householdId).eq('user_id',account.user.id).maybeSingle();
      const liveChoice=await admin.from('mia_live_privacy_choices').select('withdrawn_at').eq('user_id',account.user.id).maybeSingle();
      if(denied || membership.error || !membership.data || liveChoice.error || !liveChoice.data || liveChoice.data.withdrawn_at){send({type:'mia.error',message:'Live voice access ended. Check your account and privacy choices.'});finish();}
     }catch{finish();}
    },15000);
   }catch(error){send({type:'mia.error',message:error instanceof Error?error.message:'Live voice is unavailable.'});finish();}
   return;
  }
  if(phase!=='ready' || upstream?.readyState!==WebSocket.OPEN)return;
  if(event.type==='input_audio_buffer.append' && typeof event.audio==='string' && event.audio.length<=32768){upstream.send(JSON.stringify({type:event.type,audio:event.audio}));return;}
  if(event.type==='response.cancel'){if(activeResponse)upstream.send(JSON.stringify({type:event.type}));return;}
  if(event.type==='conversation.item.truncate' && audioItems.has(event.item_id) && Number.isFinite(event.audio_end_ms) && event.audio_end_ms>=0){upstream.send(JSON.stringify({type:event.type,item_id:event.item_id,content_index:0,audio_end_ms:Math.min(event.audio_end_ms,180000)}));return;}
  if(event.type==='tool_result' && calls.delete(event.call_id)){
   if(!await chargeText())return;
   upstream.send(JSON.stringify({type:'conversation.item.create',item:{type:'function_call_output',call_id:event.call_id,output:JSON.stringify(event.result ?? {}).slice(0,3000)}}));
   upstream.send(JSON.stringify({type:'response.create'}));return;
  }
  if(event.type==='reply' && typeof event.text==='string'){
   if(!await chargeText())return;
   if(activeResponse)upstream.send(JSON.stringify({type:'response.cancel'}));
   upstream.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:`App action result: ${event.text.slice(0,600)}. Say this result briefly, then wait.`}]}}));
   upstream.send(JSON.stringify({type:'response.create'}));
  }
 };
 return response;
});
