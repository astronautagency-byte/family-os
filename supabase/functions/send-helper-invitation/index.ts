import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PublishCommand,SNSClient } from 'npm:@aws-sdk/client-sns@3';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 let claim:string|undefined;
 try{
  const jwt=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!jwt)return json({error:'Sign in as the family owner'},401);
  const {data:{user},error}=await admin.auth.getUser(jwt);if(error||!user?.email_confirmed_at)return json({error:'Verified family owner sign-in required'},401);
  const body=await req.json();if(!/^[a-f0-9]{64}$/.test(body.token||'')||typeof body.passcode!=='string'||body.passcode.length>64)return json({error:'Invalid invitation'},400);
  const {data,error:claimError}=await admin.rpc('claim_helper_sms',{access_id:body.id,actor:user.id,token:body.token,passcode:body.passcode});
  if(claimError)return json({error:claimError.message},400);claim=data.id;
  const message=`FamOS helper invitation. Open https://home.fam-os.app/helpers#invite=${body.token}&guest=1 and enter passcode: ${body.passcode}\nPrivate access to selected lists and calendars only. Keep this message private. Reply STOP to opt out.`;
  let accepted=false;
  const key=Deno.env.get('AWS_ACCESS_KEY_ID'),secret=Deno.env.get('AWS_SECRET_ACCESS_KEY');
  if(key&&secret){try{const sns=new SNSClient({region:Deno.env.get('AWS_REGION')||'ca-central-1',credentials:{accessKeyId:key,secretAccessKey:secret}});const r=await sns.send(new PublishCommand({PhoneNumber:data.phone,Message:message,MessageAttributes:{'AWS.SNS.SMS.SMSType':{DataType:'String',StringValue:'Transactional'}}}));accepted=!!r.MessageId;}catch{/* Try the configured alternate provider without logging private message data. */}}
  const textbelt=Deno.env.get('TEXTBELT_API_KEY');
  if(!accepted&&textbelt){const r=await fetch('https://textbelt.com/text',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:data.phone,message,key:textbelt})});const value=await r.json();accepted=r.ok&&value.success===true;}
  await admin.from('helper_invitation_deliveries').update({status:accepted?'accepted':'failed'}).eq('id',claim);
  return accepted?json({accepted:true,channel:'sms'}):json({error:'SMS was not accepted by the delivery service. Share the invitation manually or try again later.'},502);
 }catch{if(claim)await admin.from('helper_invitation_deliveries').update({status:'failed'}).eq('id',claim);return json({error:'Could not send the invitation. Share it manually or try again later.'},400);}
});
