/** Bounded requests; provider errors must never leak the family's prompt. */
export async function requestAiChat({providers,messages,tools,fetchImpl=fetch}){
 let lastResponse=null;
 for(const provider of providers){
  const groq=provider.name==='groq';
  const body={model:provider.model,messages,temperature:.3,...(groq?{max_completion_tokens:2048,tools,tool_choice:'auto'}:{max_tokens:1024})};
  if(groq && provider.model.includes('gpt-oss'))body.reasoning_effort='low';
  try{
   lastResponse=await fetchImpl(provider.url,{method:'POST',headers:{Authorization:`Bearer ${provider.key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(groq?12000:6000)});
   if(lastResponse.ok)return lastResponse;
   await lastResponse.body?.cancel();
   console.warn('Fam AI provider request failed',provider.name,lastResponse.status);
  }catch{console.warn('Fam AI provider request could not complete',provider.name);}
 }
 return lastResponse;
}
