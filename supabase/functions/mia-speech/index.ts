import {aiPrivacyDenial} from '../_shared/aiPrivacy.ts';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { consumeUsage, usageLimitResponse } from '../_shared/usage.ts';
import { synthesizeMiaSpeech, validateSpeechText } from '../_shared/miaSpeech.js';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Content-Type':'application/json','Cache-Control':'private, no-store'};
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers});
 const privacyDenied=await aiPrivacyDenial(request,headers);if(privacyDenied)return privacyDenied;
  if(request.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers});
  if(!request.headers.get('Authorization'))return new Response(JSON.stringify({error:'Sign-in required.'}),{status:401,headers});
  try{
    const body=await request.json();let text;
    try{text=validateSpeechText(body.text);}catch{return new Response(JSON.stringify({error:'A short reply is required.'}),{status:400,headers});}
    const usage=await consumeUsage(request,'premium_api_operations');
    if(!usage.allowed)return usageLimitResponse(usage,headers);
    const audio=await synthesizeMiaSpeech({text,groqKey:Deno.env.get('GROQ_API_KEY'),xaiKey:Deno.env.get('XAI_API_KEY')});
    let binary='';for(let i=0;i<audio.bytes.length;i+=8192)binary+=String.fromCharCode(...audio.bytes.subarray(i,i+8192));
    return new Response(JSON.stringify({audio:btoa(binary),mime:audio.mime,voice:audio.provider==='groq'?'Autumn':'Eve'}),{headers});
  }catch(error){return new Response(JSON.stringify({error:'Mia’s voice is temporarily unavailable. Please try again.',code:'VOICE_UNAVAILABLE',providers:error?.providerStatuses || []}),{status:503,headers});}
});
