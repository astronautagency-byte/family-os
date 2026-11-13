export function validateSpeechText(value) {
  if(typeof value!=='string' || !value.trim() || value.length>600)throw new Error('Speech must be 1 to 600 characters.');
  return value.trim().replace(/[<>\[\]]/g,'');
}
// Use a single controlled cue so the same voice has conversational variety.
export function directMiaSpeech(text) {
  const tone=/\b(?:unavailable|couldn.t|cannot|can.t|sorry|failed|won.t)\b/i.test(text)?'warm':/^(?:done|great|perfect|all set|you.re welcome|hi|hello)\b/i.test(text)?'cheerful':text.includes('?')?'friendly':'casual';
  return `[${tone}] ${text}`;
}
export async function synthesizeMiaSpeech({text,groqKey,xaiKey,fetchImpl=fetch}) {
  text=validateSpeechText(text);
  const directed = directMiaSpeech(text);
  const providers=[
    ...(groqKey && directed.length <= 200 ?[{name:'groq',url:'https://api.groq.com/openai/v1/audio/speech',key:groqKey,voice:'Hannah',playbackRate:1.12,mime:'audio/wav',body:{model:'canopylabs/orpheus-v1-english',voice:'hannah',input:directed,response_format:'wav'}}]:[]),
    ...(xaiKey?[{name:'xai',url:'https://api.x.ai/v1/tts',key:xaiKey,voice:'Eve',playbackRate:1,mime:'audio/mpeg',body:{text,voice_id:'eve',language:'en',speed:1.12}}]:[]),
  ];
  const failures=[];
  const signal=AbortSignal.timeout(9000);
  for(const provider of providers){
    try{
      const response=await fetchImpl(provider.url,{method:'POST',signal,headers:{Authorization:`Bearer ${provider.key}`,'Content-Type':'application/json'},body:JSON.stringify(provider.body)});
      if(!response.ok){const detail=await response.json().catch(()=>({}));const code=detail?.error?.code || detail?.code;failures.push({provider:provider.name,status:response.status,...(typeof code==='string' && /^[a-zA-Z_.-]{1,80}$/.test(code)?{code}:{})});continue;}
      if(Number(response.headers.get('content-length'))>3000000)continue;
      const bytes=new Uint8Array(await response.arrayBuffer());
      if(bytes.length<100 || bytes.length>3000000)continue;
      return {bytes,mime:provider.mime,provider:provider.name,voice:provider.voice,playbackRate:provider.playbackRate};
    }catch{/* A provider failure never exposes its response, key or user text. */}
  }
  const error=new Error('Natural voice is temporarily unavailable.');error.providerStatuses=failures;throw error;
}
