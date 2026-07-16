import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { AvatarStack, Modal, PrimaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { formatTime, todayISO } from "../lib/dates";

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

export default function CalendarPage() {
  const { members, memberById, events, googleEvents, feedEvents, addEvent } = useFamily();
  const [selectedDate,setSelectedDate]=useState(todayISO());
  const selected=new Date(`${selectedDate}T12:00:00`);
  const [month,setMonth]=useState(new Date(selected.getFullYear(),selected.getMonth(),1));
  const [adding,setAdding]=useState(false);
  const [draft,setDraft]=useState({title:"",date:selectedDate,start:"18:00",end:"19:00",location:"",memberIds:[]});
  const allEvents=useMemo(()=>[...events,...googleEvents,...feedEvents],[events,googleEvents,feedEvents]);
  const cells=useMemo(()=>{
    const first=new Date(month.getFullYear(),month.getMonth(),1); const start=new Date(first); start.setDate(1-first.getDay());
    return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
  },[month]);
  const dayEvents=allEvents.filter(e=>e.start.slice(0,10)===selectedDate).sort((a,b)=>a.start.localeCompare(b.start));
  const monthLabel=month.toLocaleDateString("en-CA",{month:"long",year:"numeric"});
  const selectedLabel=selected.toLocaleDateString("en-CA",{month:"short",day:"numeric",weekday:"short"}).toUpperCase();
  const openAdd=()=>{setDraft({title:"",date:selectedDate,start:"18:00",end:"19:00",location:"",memberIds:members.map(m=>m.id)});setAdding(true);};
  const save=()=>{if(!draft.title.trim())return;addEvent({title:draft.title,start:new Date(`${draft.date}T${draft.start}:00`).toISOString(),end:new Date(`${draft.date}T${draft.end}:00`).toISOString(),location:draft.location,memberIds:draft.memberIds});setAdding(false);};
  return <div className="pb-28 reference-calendar">
    <PageHeader title="Calendar" subtitle={`${dayEvents.length} family event${dayEvents.length===1?"":"s"} today`} />
    <div className="px-5">
      <div className="month-toolbar"><div><h2>{monthLabel}</h2><p>{allEvents.filter(e=>e.start.slice(0,7)===iso(month).slice(0,7)).length} family events this month</p></div><div><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft/></button><button onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight/></button></div></div>
      <div className="month-calendar">
        <div className="weekday-row">{["SUN","MON","TUE","WED","THU","FRI","SAT"].map(d=><span key={d}>{d}</span>)}</div>
        <div className="month-grid">{cells.map(d=>{const key=iso(d),inMonth=d.getMonth()===month.getMonth(),active=key===selectedDate,count=allEvents.filter(e=>e.start.slice(0,10)===key).length;return <button key={key} className={`${inMonth?"":"outside"} ${active?"selected":""}`} onClick={()=>setSelectedDate(key)}><b>{d.getDate()}</b>{count>0&&<span>{Array.from({length:Math.min(count,3)},(_,i)=><i key={i}/>)}</span>}</button>})}</div>
      </div>
      <div className="calendar-legend"><span><i className="family"/>Family</span><span><i className="school"/>School</span><span><i className="work"/>Work</span></div>
      <div className="agenda-heading"><h3>DAY AT A GLANCE</h3><span>{selectedLabel}</span></div>
      <div className="day-agenda">{dayEvents.length===0?<p className="empty-agenda">No events scheduled.</p>:dayEvents.map(ev=>{const people=(ev.memberIds||[]).map(id=>memberById[id]).filter(Boolean);return <div className="agenda-row" key={ev.id}><time>{formatTime(ev.start)}</time><div><strong>{ev.title}</strong><p>{ev.location&&<><MapPin size={12}/>{ev.location} · </>}{people.map(p=>p.name).join(", ")}</p></div><AvatarStack members={people}/></div>})}</div>
      <button className="reference-fab" onClick={openAdd}><Plus/></button>
    </div>
    <Modal open={adding} onClose={()=>setAdding(false)} title="Add family event"><TextField label="Event" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/><TextField label="Date" type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/><TextField label="Location" value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})}/><PrimaryButton onClick={save}>Add event</PrimaryButton></Modal>
  </div>;
}
