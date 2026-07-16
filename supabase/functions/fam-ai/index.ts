import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const tools=[
 {type:"function",function:{name:"add_task",description:"Create a household task or chore",parameters:{type:"object",properties:{title:{type:"string"},assignee_name:{type:"string"},due_date:{type:"string",description:"YYYY-MM-DD"},task_type:{type:"string",enum:["home","errand","family","work","personal"]}},required:["title","due_date"]}}},
 {type:"function",function:{name:"add_grocery",description:"Add an item to the shared grocery list",parameters:{type:"object",properties:{name:{type:"string"},category:{type:"string"},quantity:{type:"number"},unit:{type:"string"}},required:["name"]}}},
 {type:"function",function:{name:"add_event",description:"Add an event to the FamilyOS calendar",parameters:{type:"object",properties:{title:{type:"string"},start:{type:"string",description:"ISO 8601 date-time"},end:{type:"string",description:"ISO 8601 date-time"},location:{type:"string"},member_names:{type:"array",items:{type:"string"}}},required:["title","start","end"]}}},
 {type:"function",function:{name:"plan_meal",description:"Plan a meal in the weekly meal planner",parameters:{type:"object",properties:{date:{type:"string",description:"YYYY-MM-DD"},slot:{type:"string",enum:["breakfast","lunch","dinner"]},title:{type:"string"},notes:{type:"string"},cook_names:{type:"array",items:{type:"string"}}},required:["date","slot","title"]}}},
];

Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const authorization=request.headers.get("Authorization"); if(!authorization)throw new Error("Sign in to use Fam AI.");
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}}});
  const {data:{user},error}=await supabase.auth.getUser(); if(error||!user)throw new Error("Your session has expired.");
  const xaiKey=Deno.env.get("XAI_API_KEY"); const groqKey=Deno.env.get("GROQ_API_KEY"); if(!xaiKey&&!groqKey)throw new Error("Fam AI's server credential is not configured yet.");
  const {messages=[],context={}}=await request.json();
  const system=`You are Fam AI, a concise and warm assistant inside FamilyOS. Help families organize their home. Today is ${new Date().toISOString().slice(0,10)}.

Use the supplied household context as the source of truth for analytical questions. If the user asks which day is busiest, what is due, what is planned, what is missing, whether the budget is on track, or similar, answer directly from the context instead of giving a generic checklist. For busiest-day questions, compare upcomingEvents, openTasks/tasks, and plannedMeals by date; count calendar events, due tasks, and meals; then name the day, explain why, and give one practical suggestion.

Use functions only when the user clearly asks to change app data. You may call multiple functions. Never claim an action was completed; say it is ready for review. Make reasonable defaults for household organization requests when context is sufficient. Ask a question only when required dates, people, or details are genuinely missing and cannot be inferred.

Household context: ${JSON.stringify(context)}`;
  const providers=[...(xaiKey?[{name:"primary",url:"https://api.x.ai/v1/chat/completions",key:xaiKey,model:Deno.env.get("XAI_MODEL")||"grok-4.5"}]:[]),...(groqKey?[{name:"fallback",url:"https://api.groq.com/openai/v1/chat/completions",key:groqKey,model:"llama-3.1-8b-instant"}]:[])];
  let response:Response|null=null; let lastDetail="";
  for(const provider of providers){
   response=await fetch(provider.url,{method:"POST",headers:{Authorization:`Bearer ${provider.key}`,"Content-Type":"application/json"},body:JSON.stringify({model:provider.model,messages:[{role:"system",content:system},...messages.slice(-12)],tools,tool_choice:"auto",parallel_tool_calls:true,temperature:.3})});
   if(response.ok)break;
   lastDetail=(await response.text()).slice(0,180);
   console.error(`Fam AI ${provider.name} provider error`,response.status,lastDetail);
  }
  if(!response)throw new Error("Fam AI could not reach its assistant service. Please try again.");
  if(!response.ok){
   if(response.status===429)throw new Error("Fam AI is receiving too many requests. Please try again shortly.");
   console.error("Fam AI providers unavailable",response.status,lastDetail);
   throw new Error("Fam AI could not reach its assistant service. Please try again.");
  }
  const payload=await response.json(); const message=payload.choices?.[0]?.message||{};
  const actions=(message.tool_calls||[]).filter((call:any)=>call.type==="function").map((call:any)=>{let args={};try{args=JSON.parse(call.function.arguments||"{}")}catch{/* return empty args for validation in client */}return{id:call.id||crypto.randomUUID(),type:call.function.name,args};});
  return new Response(JSON.stringify({message:message.content|| (actions.length?`I prepared ${actions.length} action${actions.length===1?"":"s"} for your review.`:"How can I help your family?"),actions}),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(error){return new Response(JSON.stringify({error:error.message}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});
