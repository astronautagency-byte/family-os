import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { consumeUsage, usageLimitResponse } from "../_shared/usage.ts";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const MAX_CONTEXT_MESSAGES=8;

// Structured output schema the client validates before acting (PRD §9).
const tools=[
 {type:"function",function:{name:"add_task",description:"Create a household task or chore",parameters:{type:"object",properties:{title:{type:"string"},assignee_name:{type:"string"},due_date:{type:"string",description:"YYYY-MM-DD"},task_type:{type:"string",enum:["home","errand","family","work","personal"]}},required:["title"]}}},
 {type:"function",function:{name:"add_grocery",description:"Add an item to the shared grocery list",parameters:{type:"object",properties:{name:{type:"string"},category:{type:"string"},quantity:{type:"number"},unit:{type:"string"}},required:["name"]}}},
 {type:"function",function:{name:"add_event",description:"Add an event to the FamilyOS calendar",parameters:{type:"object",properties:{title:{type:"string"},start:{type:"string",description:"ISO 8601 date-time"},end:{type:"string",description:"ISO 8601 date-time"},location:{type:"string"},member_names:{type:"array",items:{type:"string"}}},required:["title","start","end"]}}},
 {type:"function",function:{name:"plan_meal",description:"Plan a meal in the weekly meal planner",parameters:{type:"object",properties:{date:{type:"string",description:"YYYY-MM-DD"},slot:{type:"string",enum:["breakfast","lunch","dinner"]},title:{type:"string"},notes:{type:"string"},cook_names:{type:"array",items:{type:"string"}}},required:["date","slot","title"]}}},
];

// Red-flag guardrails (PRD §27): refuse expert/unsafe claims but stay
// operational. Mirrors the client-side classifier as a server backstop.
const RED_PATTERNS=[
 /\b(diagnos|medication dosage|prescribe|symptoms of|should i take|is my child (?:sick|ill|autistic|adhd)|overdose|poisoning)\b/i,
 /\b(legal advice|child custody|divorce advice|is it legal|sue|lawsuit)\b/i,
 /\b(diagnos.*(?:depression|anxiety|adhd|autism|bipolar))\b/i,
 /\b(secretly (?:track|watch|monitor)|spy on|without (?:them|her|him|their) knowing|hide (?:my|this) (?:location|activity|messages?))\b/i,
 /\b(how (?:to )?(?:make|build) (?:a bomb|an explosive|weapons?)|self.?harm|suicide)\b/i,
 /\b(emergency|911|call an ambulance)\b/i,
];
const GENERAL_KNOWLEDGE_RE=/^(who (?:won|is|was) |what (?:is|was) |when (?:was|did) |how (?:tall|big|far|long) (?:is|was) )/i;

const RED_RESPONSE="I can’t act as a medical, legal, or financial expert, and I won’t help with anything that could put your family at risk or bypass someone’s privacy. I can still help with the operational side — for example, I can cancel or reschedule the activity, find the event details, or adjust transportation.";
const OUT_OF_SCOPE_RESPONSE="Fam AI is designed to help manage your household and family activities. I can help with schedules, lists, groceries, tasks, and planning — but general knowledge questions are outside what I do.";

function structuredEnvelope(message:string,intent:string,confidence:number,entities:Record<string,unknown>,requiresConfirmation:boolean,missingFields:string[],actions:unknown[]){
 return {message,intent,confidence,entities,requires_confirmation:requiresConfirmation,missing_fields:missingFields,actions};
}

Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const authorization=request.headers.get("Authorization"); if(!authorization)throw new Error("Sign in to use Fam AI.");
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}}});
  const {data:{user},error}=await supabase.auth.getUser(); if(error||!user)throw new Error("Your session has expired.");
  const usage=await consumeUsage(request,"famai_queries"); if(!usage.allowed)return usageLimitResponse(usage,cors);
  const xaiKey=Deno.env.get("XAI_API_KEY"); const groqKey=Deno.env.get("GROQ_API_KEY"); if(!xaiKey&&!groqKey)throw new Error("Fam AI's server credential is not configured yet.");
  const {messages=[],context={}}=await request.json();

  const lastUser=(messages as any[]).filter((m:any)=>m.role==="user").pop()?.content as string||"";
  if(RED_PATTERNS.some((re)=>re.test(lastUser))){
   return new Response(JSON.stringify(structuredEnvelope(RED_RESPONSE,"REFUSED",1,{},false,[],[])),{headers:{...cors,"Content-Type":"application/json"}});
  }
  if(GENERAL_KNOWLEDGE_RE.test(lastUser)&&!/household|family|calendar|event|task|grocery|meal|list|schedule|today|tomorrow|weekend|saturday|sunday|driver/i.test(lastUser)){
   return new Response(JSON.stringify(structuredEnvelope(OUT_OF_SCOPE_RESPONSE,"OUT_OF_SCOPE",1,{},false,[],[])),{headers:{...cors,"Content-Type":"application/json"}});
  }

  const system=`You are Fam AI, the action layer inside FamOS. Today is ${new Date().toISOString().slice(0,10)}. You convert household requests into a single structured JSON response — you never write to the database yourself, and you never claim something was done; the app executes after the user approves.

Respond with a JSON object exactly shaped as:
{
 "intent": "one of ADD_LIST_ITEM, CREATE_EVENT, CREATE_TASK, ADD_TASK, ADD_GROCERY, ADD_EVENT, PLAN_MEAL, GET_SCHEDULE, GET_TODAY, GET_LIST, GET_DRIVER, GENERATE_GROCERY_LIST, GENERATE_PACKING_LIST, PLAN_WEEK, HELP, OUT_OF_SCOPE, NEEDS_CLARIFICATION",
 "confidence": 0.0 to 1.0,
 "entities": { ...any fields the action needs; use the household context for member names, dates, slots },
 "requires_confirmation": true for ALL actions — every add, create, or change must show a preview card for user approval. Never set false.
 "missing_fields": ["list of entity keys still needed"],
 "message": "one or two short, calm sentences for the user. If you are preparing actions, say what you prepared and that it awaits their review. If entities are missing, ask ONE concise question.",
 "actions": [ { "type":"add_task|add_grocery|add_event|plan_meal", "args":{...} } ]
}

Rules:
- Answer analytical questions (busiest day, what's on today, what's left, driver) directly from the supplied household context — no actions, message only.
- CRITICAL: Only prepare actions when the user EXPLICITLY asks to add, create, or change something. Questions like "what do we need", "what should I buy", "what's for dinner", "suggest meals" are READ-ONLY queries — answer with information and suggestions, NEVER with actions.
- Never proactively add groceries, tasks, or events unless the user's message contains a clear imperative command ("add milk", "create a task for...", "schedule soccer").
- When suggesting meals or groceries, list them as text suggestions the user can choose to add — do NOT auto-prepare add_grocery or plan_meal actions.
- Only use plan_meal when the user explicitly says "plan dinner for Tuesday" or "add tacos to Wednesday". Never use it for suggestions.
- Keep responses short and actionable. No emoji. Neutral, non-judgmental tone.
- Teen requests: allowed for scheduling, lists, rides, personal events, availability, tasks, gear, planning. NEVER prepare actions that change privacy, invite/remove members, or change permissions.
- If the request is unrelated to the household (general knowledge, celebrity, world events), use OUT_OF_SCOPE with a brief message.
- The user is currently on screen: ${context.screen||"today"}.

Household context (compact): ${JSON.stringify(context)}`;

  // NOTE: `response_format: {type:"json_object"}` is deliberately NOT sent
  // alongside `tools` — OpenAI-compatible providers (xAI and Groq) reject
  // that combination with a 400. The system prompt already demands JSON and
  // the client validates it, so we rely on that instead.
  const groqModel=Deno.env.get("GROQ_MODEL")||"openai/gpt-oss-20b";
  const providers=[...(xaiKey?[{name:"primary",url:"https://api.x.ai/v1/chat/completions",key:xaiKey,model:Deno.env.get("XAI_MODEL")||"grok-4.6"}]:[]),...(groqKey?[{name:"fallback",url:"https://api.groq.com/openai/v1/chat/completions",key:groqKey,model:groqModel}]:[])];
  let response:Response|null=null; let lastDetail="";
  for(const provider of providers){
   const body:Record<string,unknown>={model:provider.model,messages:[{role:"system",content:system},...messages.slice(-MAX_CONTEXT_MESSAGES)],temperature:.3};
   // xAI may reject tools+parallel_tool_calls combo; Groq handles them fine
   if(provider.name!=="primary"){body.tools=tools;body.tool_choice="auto";}
   response=await fetch(provider.url,{method:"POST",headers:{Authorization:`Bearer ${provider.key}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(response.ok)break;
   lastDetail=(await response.text()).slice(0,300);
   console.error(`Fam AI ${provider.name} provider error`,response.status,lastDetail);
  }
  if(!response)throw new Error("Fam AI could not reach its assistant service. Please try again.");
  if(!response.ok){
   if(response.status===429)throw new Error("Fam AI is receiving too many requests. Please try again shortly.");
   console.error("Fam AI providers unavailable",response.status,lastDetail);
   throw new Error("Fam AI could not reach its assistant service. Please try again.");
  }

  const payload=await response.json(); const message=payload.choices?.[0]?.message||{};
  const content=message.content||"";

  // Prefer structured JSON from content; fall back to tool calls for older
  // models that ignore response_format.
  let parsed:any=null;
  try{
   const start=content.indexOf("{"); const end=content.lastIndexOf("}");
   if(start>=0&&end>start) parsed=JSON.parse(content.slice(start,end+1));
  }catch{ /* fall through to tool calls */ }

  const actions=(message.tool_calls||[]).filter((call:any)=>call.type==="function").map((call:any)=>{let args={};try{args=JSON.parse(call.function.arguments||"{}")}catch{/* empty args validated in client */}return{id:call.id||crypto.randomUUID(),type:call.function.name,args};});

  if(parsed){
   // Schema validation (PRD §9): never pass malformed output through.
   const intent=typeof parsed.intent==="string"?parsed.intent:"NEEDS_CLARIFICATION";
   const confidence=typeof parsed.confidence==="number"?Math.max(0,Math.min(1,parsed.confidence)):0.5;
   const entities=parsed.entities&&typeof parsed.entities==="object"?parsed.entities:{};
   const requires=parsed.requires_confirmation===true||["CREATE_EVENT","UPDATE_EVENT","CANCEL_EVENT","PLAN_WEEK","GENERATE_PACKING_LIST","GENERATE_GROCERY_LIST","OFFER_DRIVE"].includes(intent);
   const missing=Array.isArray(parsed.missing_fields)?parsed.missing_fields.filter((f:unknown)=>typeof f==="string"):[];
   const envActions=Array.isArray(parsed.actions)?parsed.actions.filter((a:any)=>a&&typeof a==="object"&&["add_task","add_grocery","add_event","plan_meal"].includes(a.type)).map((a:any,i:number)=>({id:`ai-${i}-${a.type}`,type:a.type,args:typeof a.args==="object"?a.args:{}})):actions;
   return new Response(JSON.stringify(structuredEnvelope(parsed.message||message.content||"How can I help your family?",intent,confidence,entities,requires,missing,envActions)),{headers:{...cors,"Content-Type":"application/json"}});
  }

  const fallbackIntent=actions.length?"ADD_LIST_ITEM":"GET_TODAY";
  return new Response(JSON.stringify(structuredEnvelope(message.content||(actions.length?`I prepared ${actions.length} action${actions.length===1?"":"s"} for your review.`:"How can I help your family?"),fallbackIntent,0.8,{},actions.length>0,actions.length?[]:["intent"],actions)),{headers:{...cors,"Content-Type":"application/json"}});
 }catch(error){return new Response(JSON.stringify({error:error.message}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});
