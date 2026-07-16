import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Plus, Trash2 } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { AvatarStack, Modal, PrimaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { formatTime, todayISO } from "../lib/dates";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const EVENT_TYPES = {
  family: { label: "Family", color: "#5b55d6" },
  school: { label: "School", color: "#4f8177" },
  activity: { label: "Activities", color: "#dc9147" },
  health: { label: "Health", color: "#d46b7a" },
  work: { label: "Work", color: "#747184" },
};
const eventType = (event) => {
  if (event.eventType && EVENT_TYPES[event.eventType]) return event.eventType;
  const text = `${event.title} ${event.location || ""}`.toLowerCase();
  if (/school|class|teacher|homework|project/.test(text)) return "school";
  if (/doctor|dentist|clinic|health|appointment/.test(text)) return "health";
  if (/practice|soccer|hockey|dance|game|gym|swim/.test(text)) return "activity";
  if (/work|meeting|client|office/.test(text)) return "work";
  return "family";
};
const sourceId = (event) => event.source === "google" ? `google:${event.calendarId||"primary"}` : event.sourceFeedId ? `feed:${event.sourceFeedId}` : "family";

export default function CalendarPage() {
  const { members, memberById, events, googleEvents, feedEvents, calendarFeeds, googleConnected, googleCalendars, selectedGoogleCalendarIds, addEvent, addGoogleCalendarEvent, clearEvents } = useFamily();
  const [selectedDate,setSelectedDate]=useState(todayISO());
  const selected=new Date(`${selectedDate}T12:00:00`);
  const [month,setMonth]=useState(new Date(selected.getFullYear(),selected.getMonth(),1));
  const [sourceFilter,setSourceFilter]=useState("all");
  const [adding,setAdding]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState("");
  const [clearing,setClearing]=useState(false);
  const [draft,setDraft]=useState({title:"",date:selectedDate,start:"18:00",end:"19:00",location:"",memberIds:[],eventType:"family",destination:"family"});
  const allEvents=useMemo(()=>[...events,...googleEvents,...feedEvents],[events,googleEvents,feedEvents]);
  const visibleEvents=useMemo(()=>sourceFilter === "all" ? allEvents : allEvents.filter((event)=>sourceId(event)===sourceFilter),[allEvents,sourceFilter]);
  const sources=useMemo(()=>[
    {id:"all",label:"All calendars"},{id:"family",label:"Family"},
    ...(googleConnected?googleCalendars.filter(calendar=>selectedGoogleCalendarIds.includes(calendar.id)).map(calendar=>({id:`google:${calendar.id}`,label:calendar.summary,color:calendar.backgroundColor})):[]),
    ...calendarFeeds.map((feed)=>({id:`feed:${feed.id}`,label:feed.name})),
  ],[calendarFeeds,googleConnected,googleCalendars,selectedGoogleCalendarIds]);
  const cells=useMemo(()=>{const first=new Date(month.getFullYear(),month.getMonth(),1);const start=new Date(first);start.setDate(1-first.getDay());return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});},[month]);
  const dayEvents=visibleEvents.filter(e=>e.start.slice(0,10)===selectedDate).sort((a,b)=>a.start.localeCompare(b.start));
  const monthLabel=month.toLocaleDateString("en-CA",{month:"long",year:"numeric"});
  const selectedLabel=selected.toLocaleDateString("en-CA",{month:"short",day:"numeric",weekday:"short"}).toUpperCase();
  const openAdd=()=>{setDraft({title:"",date:selectedDate,start:"18:00",end:"19:00",location:"",memberIds:members.map(m=>m.id),eventType:"family",destination:"family"});setSaveError("");setAdding(true);};
  const save=async()=>{if(!draft.title.trim())return;setSaving(true);setSaveError("");const payload={title:draft.title.trim(),start:new Date(`${draft.date}T${draft.start}:00`).toISOString(),end:new Date(`${draft.date}T${draft.end}:00`).toISOString(),location:draft.location,memberIds:draft.memberIds,eventType:draft.eventType};try{if(draft.destination.startsWith("google:"))await addGoogleCalendarEvent({...payload,calendarId:draft.destination.slice(7)});else await addEvent(payload);setAdding(false);}catch(error){setSaveError(error.message||"Could not save this event.");}finally{setSaving(false);}};

  return <div className="pb-28 reference-calendar">
    <PageHeader title="Calendar" illustration="calendar" subtitle={`${dayEvents.length} event${dayEvents.length===1?"":"s"} on the selected day`} action={events.length?<button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>:null} />
    <div className="px-5">
      <div className="calendar-source-filters" aria-label="Calendars">{sources.map(source=><button key={source.id} className={sourceFilter===source.id?"selected":""} onClick={()=>setSourceFilter(source.id)}>{source.color&&<i style={{backgroundColor:source.color}}/>}{source.label}</button>)}</div>
      <div className="month-toolbar"><div><h2>{monthLabel}</h2><p>{visibleEvents.filter(e=>e.start.slice(0,7)===iso(month).slice(0,7)).length} events this month</p></div><div><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft/></button><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight/></button></div></div>
      <div className="month-calendar">
        <div className="weekday-row">{["SUN","MON","TUE","WED","THU","FRI","SAT"].map(d=><span key={d}>{d}</span>)}</div>
        <div className="month-grid">{cells.map(d=>{const key=iso(d),inMonth=d.getMonth()===month.getMonth(),active=key===selectedDate,cellEvents=visibleEvents.filter(e=>e.start.slice(0,10)===key);return <button key={key} className={`${inMonth?"":"outside"} ${active?"selected":""}`} onClick={()=>setSelectedDate(key)}><b>{d.getDate()}</b>{cellEvents.length>0&&<span>{cellEvents.slice(0,3).map(event=><i key={event.id} style={{backgroundColor:EVENT_TYPES[eventType(event)].color}}/>)}</span>}</button>})}</div>
      </div>
      <div className="calendar-legend">{Object.entries(EVENT_TYPES).map(([key,type])=><span key={key}><i style={{backgroundColor:type.color}}/>{type.label}</span>)}</div>
      <div className="agenda-heading"><h3>DAY AT A GLANCE</h3><span>{selectedLabel}</span></div>
      <div className="day-agenda">{dayEvents.length===0?<p className="empty-agenda">No events scheduled.</p>:dayEvents.map(ev=>{const people=(ev.memberIds||[]).map(id=>memberById[id]).filter(Boolean);const type=EVENT_TYPES[eventType(ev)];return <div className="agenda-row" style={{"--event-color":type.color}} key={ev.id}><time>{formatTime(ev.start)}</time><div><span className="event-type-label"><i style={{backgroundColor:type.color}}/>{type.label}</span><strong>{ev.title}</strong><p>{ev.location&&<><MapPin size={12}/>{ev.location}</>}{ev.location&&people.length>0&&" · "}{people.map(p=>p.name).join(", ")}</p></div><AvatarStack members={people}/></div>})}</div>
      <button className="reference-fab" onClick={openAdd} aria-label="Add event"><Plus/></button>
    </div>
    <Modal open={adding} onClose={()=>setAdding(false)} title="Add event">
      <TextField label="Event" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/>
      <div className="calendar-form-row"><TextField label="Date" type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/><TextField label="Starts" type="time" value={draft.start} onChange={e=>setDraft({...draft,start:e.target.value})}/><TextField label="Ends" type="time" value={draft.end} onChange={e=>setDraft({...draft,end:e.target.value})}/></div>
      <TextField label="Location (optional)" value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})}/>
      <label className="calendar-select-label"><span>Event type</span><select value={draft.eventType} onChange={e=>setDraft({...draft,eventType:e.target.value})}>{Object.entries(EVENT_TYPES).map(([key,type])=><option key={key} value={key}>{type.label}</option>)}</select></label>
      <label className="calendar-select-label"><span>Add to</span><select value={draft.destination} onChange={e=>setDraft({...draft,destination:e.target.value})}><option value="family">FamilyOS calendar</option>{googleConnected&&googleCalendars.filter(calendar=>selectedGoogleCalendarIds.includes(calendar.id)&&["owner","writer"].includes(calendar.accessRole)).map(calendar=><option key={calendar.id} value={`google:${calendar.id}`}>{calendar.summary} · Google</option>)}</select></label>
      {calendarFeeds.length>0&&<p className="calendar-readonly-note">Imported calendars are available in the filters above, but remain read-only.</p>}
      {saveError&&<p className="calendar-save-error">{saveError}</p>}
      <PrimaryButton onClick={save} disabled={saving}>{saving?"Adding…":"Add event"}</PrimaryButton>
    </Modal>
    <Modal open={clearing} onClose={()=>setClearing(false)} title="Reset FamilyOS calendar?"><p className="reset-confirm-copy">This removes FamilyOS events only. Connected Google and imported calendars are not changed.</p><div className="reset-confirm-actions"><button onClick={()=>setClearing(false)}>Cancel</button><PrimaryButton onClick={async()=>{await clearEvents();setClearing(false)}}>Clear FamilyOS events</PrimaryButton></div></Modal>
  </div>;
}
