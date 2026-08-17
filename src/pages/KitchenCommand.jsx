import { useState } from "react";
import { Backpack, CalendarDays, Car, Check, Clock3, ListChecks, LogOut, ShieldCheck, ShoppingBasket, Sparkles } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { useCoordination } from "../context/CoordinationContext";

const dateKey=(value)=>new Date(value).toISOString().slice(0,10);
const todayKey=()=>dateKey(new Date());
const time=(value)=>new Date(value).toLocaleTimeString("en-CA",{hour:"numeric",minute:"2-digit"});

export default function KitchenCommand({onExit,openAdd}) {
  const {events,tasks,toggleTask,memberById,members}=useFamily();
  const [activeMember,setActiveMember]=useState("all");
  const {lists=[],activities=[],transportation=[],requests=[]}=useCoordination();
  const todaysEvents=events.filter(event=>dateKey(event.start)===todayKey()&&(activeMember==="all"||(event.memberIds||[]).includes(activeMember))).sort((a,b)=>new Date(a.start)-new Date(b.start));
  const openTasks=tasks.filter(task=>!task.done&&(activeMember==="all"||task.assigneeId===activeMember)).slice(0,7);
  const grocery=lists.find(list=>list.listType==="grocery")||lists[0];
  const openGroceries=(grocery?.items||[]).filter(item=>item.status!=="done").slice(0,6);
  const next=todaysEvents.find(event=>new Date(event.end)>new Date())||todaysEvents[0];
  const activity=activities.find(item=>item.id===next?.activityId);
  const ride=transportation.find(item=>item.eventId===next?.id||item.activityId===activity?.id);
  const firstName=(id)=>memberById[id]?.name?.split(" ")[0]||"Family";

  return <main className="command-view">
    <header className="command-header">
      <a href="#today" onClick={onExit} className="command-brand"><img src="/brand/famos-icon.png" alt=""/><strong>FamOS</strong><span>Kitchen Command</span></a>
      <div className="command-date"><strong>{new Date().toLocaleDateString("en-CA",{weekday:"long",month:"long",day:"numeric"})}</strong><span>{time(new Date())}</span></div>
      <button onClick={onExit}><LogOut/> Exit display</button>
    </header>
    <nav className="command-profiles" aria-label="Filter command center by family member"><button className={activeMember==="all"?"active":""} onClick={()=>setActiveMember("all")}><span>All</span><small>Household</small></button>{members.map(member=><button key={member.id} className={activeMember===member.id?"active":""} onClick={()=>setActiveMember(member.id)}><i className={`fam-${member.color||"plum"}`}>{member.name?.[0]}</i><span>{member.name?.split(" ")[0]}</span></button>)}</nav>

    <section className="command-hero">
      <div><span>Household pulse</span><h1>{todaysEvents.length} plans, {openTasks.length} open tasks.</h1><p>One calm view for everyone passing through the kitchen.</p></div>
      <button onClick={()=>openAdd("capture")}><Sparkles/> Capture something</button>
    </section>

    <div className="command-grid">
      <section className="command-card command-schedule"><header><span><CalendarDays/> Today</span><small>{todaysEvents.length} events</small></header>
        <div>{todaysEvents.length?todaysEvents.map(event=><article key={event.id} className={event.id===next?.id?"is-next":""}><time>{time(event.start)}</time><i/><span><strong>{event.title}</strong><small>{event.location||"Location not set"} · {(event.memberIds||[]).map(firstName).join(", ")}</small></span>{event.id===next?.id&&<em>Next</em>}</article>):<p className="command-empty">Nothing scheduled today.</p>}</div>
      </section>

      <section className="command-card command-readiness"><header><span><Clock3/> Up next</span></header>
        {next?<div className="command-next"><span>{time(next.start)}</span><h2>{next.title}</h2><p>{next.location||activity?.defaultLocation||"Location not set"}</p><div><span className={ride?.driverId?"ready":"attention"}><Car/> {ride?.driverId?`${firstName(ride.driverId)} is driving`:"Driver needed"}</span><span className={(activity?.gearKit?.items||[]).every(item=>item.ready)?"ready":"attention"}><Backpack/> {(activity?.gearKit?.items||[]).filter(item=>item.ready).length}/{activity?.gearKit?.items?.length||0} gear ready</span></div></div>:<p className="command-empty">The rest of today is open.</p>}
      </section>

      <section className="command-card command-tasks"><header><span><ListChecks/> Tasks</span><button onClick={()=>openAdd("task")}>Add</button></header>
        <div>{openTasks.map(task=><article key={task.id}><button onClick={()=>toggleTask(task.id)} aria-label={`Complete ${task.title}`}><Check/></button><span><strong>{task.title}</strong><small>{task.due?`Due ${task.due===todayKey()?"today":task.due}`:"No due date"}</small></span><em>{firstName(task.assigneeId)}</em></article>)}</div>
      </section>

      <section className="command-card command-list"><header><span><ShoppingBasket/> {grocery?.title||"Family list"}</span><button onClick={()=>openAdd("list")}>Add</button></header>
        <div>{openGroceries.length?openGroceries.map(item=><article key={item.id}><i/><strong>{item.title}</strong>{item.quantity>1&&<small>× {item.quantity}</small>}</article>):<p className="command-empty">The list is clear.</p>}</div>
      </section>
    </div>

    <footer className="command-footer"><ShieldCheck/> Shows household-visible items only. Private details stay in each person’s FamOS.</footer>
  </main>;
}
