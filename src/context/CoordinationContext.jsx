import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const CoordinationContext = createContext(null);
const STORAGE_KEY = "famos:coordination-mvp:v1";
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const weekStart=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay());return d.toISOString().slice(0,10)};
const gamePlanSteps=[
  {id:"activities",title:"Review activities",copy:"Confirm this week’s events and changes"},
  {id:"conflicts",title:"Resolve conflicts",copy:"Check overlaps and tight transitions"},
  {id:"rides",title:"Assign transportation",copy:"Every child activity has a ride"},
  {id:"gear",title:"Prepare gear",copy:"Review kits and missing equipment"},
  {id:"shopping",title:"Review shopping",copy:"Add snacks, supplies, and forms"},
  {id:"caregivers",title:"Confirm caregivers",copy:"Share only the details they need"},
];
const seed = {
  captureDrafts:[{id:"capture-demo-1",sourceName:"Fall term notice.pdf",sourceType:"document",status:"pending",createdAt:new Date(Date.now()-25*60_000).toISOString(),items:[{id:"draft-event-1",kind:"event",title:"School photo day",date:new Date(Date.now()+7*86400000).toISOString().slice(0,10),time:"09:00",selected:true}],confidence:"high"}],
  weeklyPlan:{id:"weekly-current",weekStart:weekStart(),status:"draft",steps:gamePlanSteps.map((s,i)=>({...s,complete:i<2}))},
  activities: [
    {id:"activity-soccer",name:"Riverside Soccer",activityType:"soccer",participantIds:["me"],organization:"Riverside FC",defaultLocation:"Riverside Field",arrivalMinutes:20,primaryDriverId:"me",backupDriverId:"partner",weatherSensitive:true,color:"#6d4de8",visibility:"household",gearKit:{id:"gear-soccer",title:"Soccer kit",items:[{id:"cleats",title:"Cleats",ready:true},{id:"guards",title:"Shin guards",ready:true},{id:"jersey",title:"Jersey",ready:true},{id:"water",title:"Water bottle",ready:false}]}},
    {id:"activity-piano",name:"Piano lessons",activityType:"music",participantIds:["partner"],organization:"Alvarez Music",defaultLocation:"Mrs. Alvarez's studio",arrivalMinutes:10,primaryDriverId:"partner",weatherSensitive:false,color:"#e46d9f",visibility:"household",gearKit:{id:"gear-piano",title:"Lesson kit",items:[{id:"books",title:"Music books",ready:true},{id:"notebook",title:"Practice notebook",ready:true}]}},
  ],
  transportation: [
    {id:"transport-soccer",eventId:"e4",activityId:"activity-soccer",driverId:"me",passengerIds:["me"],pickupLocation:"Home",destination:"Riverside Field",leaveAt:new Date(Date.now()+3_600_000).toISOString(),status:"accepted",visibility:"household"},
  ],
  calendars: [
    { id:"calendar-family", name:"Family", color:"#6d4de8", visibility:"household", isDefault:true },
    { id:"calendar-school", name:"School", color:"#e46d9f", visibility:"household" },
    { id:"calendar-personal", name:"Personal", color:"#4597d1", visibility:"private" },
  ],
  taskLists: [
    { id:"tasks-family", name:"Family", color:"#6d4de8", icon:"users", visibility:"household", isDefault:true },
    { id:"tasks-errands", name:"Errands", color:"#df862e", icon:"cart", visibility:"household" },
    { id:"tasks-personal", name:"Personal", color:"#4597d1", icon:"person", visibility:"private" },
  ],
  requests: [
    { id: "request-demo-1", title: "Can someone pick me up after practice?", requesterId: "partner", responderId: "me", deadline: new Date(Date.now() + 7_200_000).toISOString(), status: "open", visibility: "household", createdAt: new Date().toISOString() },
  ],
  lists: [{ id: "list-demo-1", title: "Weekend groceries", listType: "grocery", visibility: "household", items: [
    { id: "li-1", title: "Milk", quantity: 1, status: "open" }, { id: "li-2", title: "Soccer snacks", quantity: 2, status: "open" },
  ] }],
  routines: [{ id: "routine-demo-1", title: "School morning", recurrenceRule: "Weekdays · 7:00 AM", visibility: "household", steps: ["Pack lunches", "Fill water bottles", "Check backpacks"] }],
  activity: [{ id: "activity-demo-1", summary: "Weekend groceries was updated", actionType: "updated", entityType: "list", createdAt: new Date(Date.now() - 3_600_000).toISOString(), visibility: "household" }],
};

function readLocal() {
  try { const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)); return saved ? {...seed,...saved,calendars:saved.calendars?.length?saved.calendars:seed.calendars,taskLists:saved.taskLists?.length?saved.taskLists:seed.taskLists} : seed; } catch { return seed; }
}

const mapRequest = (r) => ({ id:r.id, title:r.title, description:r.description||"", requesterId:r.requester_id, responderId:r.responder_id, deadline:r.deadline, status:r.status, visibility:r.visibility, selectedMemberIds:r.selected_member_ids||[], createdAt:r.created_at });
const mapList = (l) => ({ id:l.id, title:l.title, listType:l.list_type, visibility:l.visibility, selectedMemberIds:l.selected_member_ids||[], items:(l.shared_list_items||[]).map(i=>({id:i.id,title:i.title,quantity:i.quantity,note:i.note,status:i.status,assigneeId:i.assignee_id,dueAt:i.due_at})) });
const mapRoutine = (r) => ({ id:r.id,title:r.title,recurrenceRule:r.recurrence_rule,visibility:r.visibility,selectedMemberIds:r.selected_member_ids||[],steps:Array.isArray(r.steps)?r.steps:[] });
const mapActivityLog = (a) => ({ id:a.id,summary:a.summary,actionType:a.action_type,entityType:a.entity_type,createdAt:a.created_at,visibility:a.visibility });
const mapCalendar = (c) => ({ id:c.id,name:c.name,color:c.color,visibility:c.visibility,selectedMemberIds:c.selected_member_ids||[],isDefault:c.is_default });
const mapTaskList = (l) => ({ id:l.id,name:l.name,color:l.color,icon:l.icon,visibility:l.visibility,selectedMemberIds:l.selected_member_ids||[],isDefault:l.is_default });
const mapActivity = (a) => ({id:a.id,name:a.name,activityType:a.activity_type,participantIds:a.participant_ids||[],organization:a.organization,contactName:a.contact_name,contactDetails:a.contact_details,defaultLocation:a.default_location,arrivalMinutes:a.arrival_minutes,primaryDriverId:a.primary_driver_id,backupDriverId:a.backup_driver_id,weatherSensitive:a.weather_sensitive,color:a.color,notes:a.notes,visibility:a.visibility,selectedMemberIds:a.selected_member_ids||[],gearKit:(a.gear_kits||[]).map(g=>({id:g.id,title:g.title,items:Array.isArray(g.items)?g.items:[]}))[0]});
const mapTransport = (t) => ({id:t.id,eventId:t.event_id,activityId:t.activity_id,driverId:t.driver_id,passengerIds:t.passenger_ids||[],backupDriverId:t.backup_driver_id,pickupLocation:t.pickup_location,destination:t.destination,pickupAt:t.pickup_at,leaveAt:t.leave_at,status:t.status,visibility:t.visibility});
const mapWeeklyPlan=(p)=>p?({id:p.id,weekStart:p.week_start,status:p.status,steps:Array.isArray(p.steps)?p.steps:gamePlanSteps,publishedAt:p.published_at}):seed.weeklyPlan;

export function CoordinationProvider({ children }) {
  const { household, session } = useAuth();
  const remote = Boolean(isSupabaseConfigured && supabase && household?.id && session?.user?.id);
  const [state,setState] = useState(readLocal);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");

  const load = useCallback(async () => {
    if (!remote) return;
    setLoading(true); setError("");
    const [requests,lists,routines,activity,calendars,taskLists,activities,transportation,weeklyPlan,captureDrafts] = await Promise.all([
      supabase.from("family_requests").select("*").order("created_at",{ascending:false}),
      supabase.from("shared_lists").select("*,shared_list_items(*)").order("created_at",{ascending:false}),
      supabase.from("routines").select("*").order("created_at",{ascending:false}),
      supabase.from("activity_log").select("*").order("created_at",{ascending:false}).limit(30),
      supabase.from("calendars").select("*").order("created_at"),
      supabase.from("task_lists").select("*").order("created_at"),
      supabase.from("activities").select("*,gear_kits(*)").order("created_at"),
      supabase.from("transportation_assignments").select("*").order("leave_at"),
      supabase.from("weekly_game_plans").select("*").eq("week_start",weekStart()).maybeSingle(),
      supabase.from("capture_drafts").select("*").eq("status","pending").order("created_at",{ascending:false}),
    ]);
    const firstError=[requests,lists,routines,activity,calendars,taskLists,activities,transportation,weeklyPlan].find(r=>r.error)?.error;
    if (firstError) { setError(/does not exist|schema cache/i.test(firstError.message||"") ? "Coordination migration is ready but has not been applied yet." : firstError.message); setLoading(false); return; }
    setState({requests:(requests.data||[]).map(mapRequest),lists:(lists.data||[]).map(mapList),routines:(routines.data||[]).map(mapRoutine),activity:(activity.data||[]).map(mapActivityLog),calendars:(calendars.data||[]).map(mapCalendar),taskLists:(taskLists.data||[]).map(mapTaskList),activities:(activities.data||[]).map(mapActivity),transportation:(transportation.data||[]).map(mapTransport),weeklyPlan:mapWeeklyPlan(weeklyPlan.data),captureDrafts:captureDrafts.error?seed.captureDrafts:(captureDrafts.data||[]).map(d=>({id:d.id,sourceName:d.source_name,sourceType:d.source_type,status:d.status,items:d.items||[],confidence:d.confidence,createdAt:d.created_at}))});
    setLoading(false);
  },[remote]);
  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ if(!remote) localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); },[remote,state]);

  const logLocal=(summary,entityType,actionType="created",visibility="household")=>({id:uid(),summary,entityType,actionType,visibility,createdAt:new Date().toISOString()});
  const addRequest=async(input)=>{
    if(remote){const row={household_id:household.id,requester_id:session.user.id,responder_id:input.responderId||null,title:input.title,description:input.description||"",deadline:input.deadline||null,visibility:input.visibility||"household",selected_member_ids:input.selectedMemberIds||[]};const {data,error:e}=await supabase.from("family_requests").insert(row).select().single();if(e)throw e;setState(s=>({...s,requests:[mapRequest(data),...s.requests]}));}
    else setState(s=>({...s,requests:[{id:uid(),status:"open",requesterId:"me",createdAt:new Date().toISOString(),...input},...s.requests],activity:[logLocal(`Request added: ${input.title}`,"request"),...s.activity]}));
  };
  const updateRequest=async(id,patch)=>{if(remote){const db={};if(patch.status)db.status=patch.status;if(patch.responderId!==undefined)db.responder_id=patch.responderId;const {error:e}=await supabase.from("family_requests").update(db).eq("id",id);if(e)throw e;}setState(s=>({...s,requests:s.requests.map(r=>r.id===id?{...r,...patch}:r),activity:[logLocal(`Request ${patch.status||"updated"}`,"request",patch.status||"updated"),...s.activity]}));};
  const addList=async(input)=>{if(remote){const {data,error:e}=await supabase.from("shared_lists").insert({household_id:household.id,title:input.title,list_type:input.listType||"custom",created_by:session.user.id,visibility:input.visibility||"household",selected_member_ids:input.selectedMemberIds||[]}).select().single();if(e)throw e;setState(s=>({...s,lists:[mapList({...data,shared_list_items:[]}),...s.lists]}));}else setState(s=>({...s,lists:[{id:uid(),items:[],...input},...s.lists],activity:[logLocal(`List created: ${input.title}`,"list"),...s.activity]}));};
  const addRoutine=async(input)=>{if(remote){const {data,error:e}=await supabase.from("routines").insert({household_id:household.id,title:input.title,recurrence_rule:input.recurrenceRule||"",steps:input.steps||[],created_by:session.user.id,visibility:input.visibility||"household",selected_member_ids:input.selectedMemberIds||[]}).select().single();if(e)throw e;setState(s=>({...s,routines:[mapRoutine(data),...s.routines]}));}else setState(s=>({...s,routines:[{id:uid(),...input},...s.routines],activity:[logLocal(`Routine created: ${input.title}`,"routine"),...s.activity]}));};
  const addCalendar=async(input)=>{if(remote){const {data,error:e}=await supabase.from("calendars").insert({household_id:household.id,name:input.name,color:input.color,created_by:session.user.id,visibility:input.visibility||"household",selected_member_ids:input.selectedMemberIds||[],is_default:false}).select().single();if(e)throw e;setState(s=>({...s,calendars:[...s.calendars,mapCalendar(data)]}));}else setState(s=>({...s,calendars:[...s.calendars,{id:uid(),...input}]}));};
  const addTaskList=async(input)=>{if(remote){const {data,error:e}=await supabase.from("task_lists").insert({household_id:household.id,name:input.name,color:input.color,icon:input.icon||"list",created_by:session.user.id,visibility:input.visibility||"household",selected_member_ids:input.selectedMemberIds||[],is_default:false}).select().single();if(e)throw e;setState(s=>({...s,taskLists:[...s.taskLists,mapTaskList(data)]}));}else setState(s=>({...s,taskLists:[...s.taskLists,{id:uid(),...input}]}));};
  const addActivity=async(input)=>{if(remote){const {data,error:e}=await supabase.from("activities").insert({household_id:household.id,name:input.name,activity_type:input.activityType||"custom",participant_ids:input.participantIds||[],organization:input.organization||"",default_location:input.defaultLocation||"",arrival_minutes:input.arrivalMinutes||15,primary_driver_id:input.primaryDriverId||null,weather_sensitive:Boolean(input.weatherSensitive),color:input.color||"#6d4de8",visibility:input.visibility||"household",selected_member_ids:input.selectedMemberIds||[],created_by:session.user.id}).select().single();if(e)throw e;setState(s=>({...s,activities:[...s.activities,mapActivity({...data,gear_kits:[]})]}));}else setState(s=>({...s,activities:[...s.activities,{id:uid(),...input,gearKit:{id:uid(),title:`${input.name} kit`,items:[]}}]}));};
  const addTransportation=async(input)=>{if(remote){const {data,error:e}=await supabase.from("transportation_assignments").insert({household_id:household.id,event_id:input.eventId||null,activity_id:input.activityId||null,driver_id:input.driverId||null,passenger_ids:input.passengerIds||[],pickup_location:input.pickupLocation||"",destination:input.destination||"",leave_at:input.leaveAt||null,status:input.driverId?"accepted":"requested",created_by:session.user.id,visibility:input.visibility||"household",selected_member_ids:input.selectedMemberIds||[]}).select().single();if(e)throw e;setState(s=>({...s,transportation:[...s.transportation,mapTransport(data)]}));}else setState(s=>({...s,transportation:[...s.transportation,{id:uid(),status:input.driverId?"accepted":"requested",...input}]}));};
  const saveWeeklyPlan=async(next)=>{if(remote){const row={household_id:household.id,week_start:next.weekStart||weekStart(),status:next.status||"draft",steps:next.steps,published_at:next.status==="published"?new Date().toISOString():null,created_by:session.user.id};const {data,error:e}=await supabase.from("weekly_game_plans").upsert(row,{onConflict:"household_id,week_start"}).select().single();if(e)throw e;setState(s=>({...s,weeklyPlan:mapWeeklyPlan(data)}));}else setState(s=>({...s,weeklyPlan:next}));};
  const toggleGamePlanStep=async(id)=>{const current=state.weeklyPlan||seed.weeklyPlan;await saveWeeklyPlan({...current,status:"draft",steps:current.steps.map(step=>step.id===id?{...step,complete:!step.complete}:step)});};
  const publishGamePlan=async()=>{const current=state.weeklyPlan||seed.weeklyPlan;await saveWeeklyPlan({...current,status:"published",publishedAt:new Date().toISOString()});};
  const addCaptureDraft=async(input)=>{const local={id:uid(),status:"pending",createdAt:new Date().toISOString(),...input};if(remote){const {data,error:e}=await supabase.from("capture_drafts").insert({household_id:household.id,created_by:session.user.id,source_name:input.sourceName||"Quick capture",source_type:input.sourceType||"text",items:input.items||[],confidence:input.confidence||"needs_review"}).select().single();if(!e){local.id=data.id;}}setState(s=>({...s,captureDrafts:[local,...(s.captureDrafts||[])]}));return local;};
  const resolveCaptureDraft=async(id,status)=>{if(remote)await supabase.from("capture_drafts").update({status,resolved_at:new Date().toISOString()}).eq("id",id);setState(s=>({...s,captureDrafts:(s.captureDrafts||[]).filter(d=>d.id!==id),activity:[logLocal(`Capture draft ${status}`,"capture",status),...s.activity]}));};
  const value=useMemo(()=>({...state,loading,error,refresh:load,addRequest,updateRequest,addList,addRoutine,addCalendar,addTaskList,addActivity,addTransportation,toggleGamePlanStep,publishGamePlan,addCaptureDraft,resolveCaptureDraft}),[state,loading,error,load]);
  return <CoordinationContext.Provider value={value}>{children}</CoordinationContext.Provider>;
}
export const useCoordination=()=>{const c=useContext(CoordinationContext);if(!c)throw new Error("useCoordination must be used within CoordinationProvider");return c;};
