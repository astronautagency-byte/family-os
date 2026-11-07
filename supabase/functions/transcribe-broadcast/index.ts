import {aiPrivacyDenial} from '../_shared/aiPrivacy.ts';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {authenticatedHousehold,consumeUsage,usageLimitResponse} from '../_shared/usage.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers});
 if(Deno.env.get('OPENAI_TRANSCRIPTION_PRIVACY_APPROVED')!=='true')return Response.json({error:'Automatic transcription is paused while privacy controls are reviewed. You can type a transcript instead.',code:'TRANSCRIPTION_PRIVACY_REVIEW'},{status:503,headers});
 const privacyDenied=await aiPrivacyDenial(request,headers);if(privacyDenied)return privacyDenied;
 if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers});
 try {
  await authenticatedHousehold(request);
  const key=Deno.env.get('OPENAI_API_KEY');
  if(!key)throw Error('Transcription is not configured. Type the voice-note text manually or try again later.');
  const reader=request.body?.getReader(); if(!reader)throw Error('Recording missing.');
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>11000000){await reader.cancel();throw Error('Recording too large.');}chunks.push(value);}
  const data=await new Response(new Blob(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
  const file=data.get('file');
  if(!(file instanceof File)||!file.size||file.size>10485760||!/^audio\/(webm|mp4|ogg)(;|$)/.test(file.type))throw Error('Use a valid voice recording under 10 MB.');
  const usage=await consumeUsage(request,'premium_api_operations');if(!usage.allowed)return usageLimitResponse(usage,headers);
  const body=new FormData();body.append('model','whisper-1');body.append('file',file);body.append('response_format','json');
  const response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body,signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error('Transcription failed. Retry or type the voice-note text manually.');
  const result=await response.json();const text=String(result.text||'').trim().slice(0,4000);
  if(!text)throw Error('No speech recognized. Record again or type the text manually.');
  return Response.json({text},{headers});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Transcription failed.'},{status:400,headers});}
});
