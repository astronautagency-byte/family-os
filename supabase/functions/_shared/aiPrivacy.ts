import { createClient } from 'jsr:@supabase/supabase-js@2';
/** Check the caller's recorded choice before reading content or calling any model. */
export async function aiPrivacyDenial(request:Request, headers:Record<string,string>) {
 const authorization=request.headers.get('Authorization');
 const response=(status:number,error:string,code:string)=>new Response(JSON.stringify({error,code}),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'private, no-store'}});
 if(!authorization)return response(401,'Sign in to use AI.','AUTH_REQUIRED');
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
 const {data,error}=await client.rpc('ai_privacy_choices',{action:'status'});
 if(error)return response(403,'AI privacy choices could not be verified. Open Settings → Account → AI privacy and try again.','AI_PRIVACY_REQUIRED');
 if(!data?.eligible)return response(403,'AI features are available only to adults aged 18 or older. Your other household features remain available.','AI_ADULT_REQUIRED');
 if(!data?.accepted)return response(403,'Enable optional AI processing in Settings → Account → AI privacy before using AI.','AI_PRIVACY_REQUIRED');
 return null;
}
