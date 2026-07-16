import { useMemo, useState } from "react";
import { GraduationCap, House, Plus, ShoppingBag } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { Avatar, Checkbox, Modal, PrimaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { todayISO } from "../lib/dates";

const GROUPS={home:{label:"Housework",Icon:House,tone:"violet"},errand:{label:"Errands",Icon:ShoppingBag,tone:"green"},family:{label:"School",Icon:GraduationCap,tone:"slate"},work:{label:"School",Icon:GraduationCap,tone:"slate"},personal:{label:"Personal",Icon:House,tone:"violet"}};

export default function Tasks(){
 const {members,memberById,tasks,addTask,toggleTask}=useFamily();
 const [adding,setAdding]=useState(false); const [draft,setDraft]=useState({title:"",assigneeId:members[0]?.id||"",due:todayISO(),taskType:"home"});
 const open=tasks.filter(t=>!t.done); const grouped=useMemo(()=>open.reduce((a,t)=>{const k=t.taskType||"home";(a[k]??=[]).push(t);return a;},{}),[open]);
 const done=tasks.filter(t=>t.done).length, pct=tasks.length?Math.round(done/tasks.length*100):0;
 const save=async()=>{if(!draft.title.trim())return;await addTask({...draft,title:draft.title.trim(),recurring:""});setAdding(false);setDraft({...draft,title:""});};
 return <div className="pb-28 reference-tasks"><PageHeader title="Family Task Board" subtitle="Helping your family stay perfectly in sync."/><div className="px-5 space-y-5">
  {Object.entries(grouped).map(([key,items])=>{const meta=GROUPS[key]||GROUPS.home;const Icon=meta.Icon;return <section className={`task-board-group ${meta.tone}`} key={key}><div className="task-group-title"><h2><Icon/>{meta.label}</h2><span>{items.length} Task{items.length===1?"":"s"}</span></div><div className="task-board-list">{items.map(t=>{const person=memberById[t.assigneeId];return <div className="task-board-row" key={t.id}><Checkbox checked={t.done} onChange={()=>toggleTask(t.id)}/><div><strong>{t.title}</strong><small>Due {t.due===todayISO()?"Today":new Date(`${t.due}T12:00`).toLocaleDateString("en-CA",{weekday:"long"})}</small></div>{person&&<Avatar member={person}/>}</div>})}</div></section>})}
  {open.length===0&&<section className="task-board-group violet"><div className="task-board-row"><strong>Everything is complete</strong></div></section>}
  <section className="weekly-progress"><h2>Weekly Progress</h2><p>Your family has completed {pct}% of their goals this week.</p><div><span style={{width:`${pct}%`}}/></div><small>{done} tasks done <b>{open.length} left</b></small></section>
  <button className="reference-fab" onClick={()=>setAdding(true)}><Plus/></button>
  </div><Modal open={adding} onClose={()=>setAdding(false)} title="Add a task"><TextField label="Task" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/><TextField label="Due date" type="date" value={draft.due} onChange={e=>setDraft({...draft,due:e.target.value})}/><p className="task-assignee-label">Assign to</p><div className="task-assignee-picker">{members.map(member=><button key={member.id} className={draft.assigneeId===member.id?"selected":""} onClick={()=>setDraft({...draft,assigneeId:member.id})}><Avatar member={member}/><span>{member.name}</span></button>)}</div><PrimaryButton onClick={save}>Add task</PrimaryButton></Modal></div>
}
