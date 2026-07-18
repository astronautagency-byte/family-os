import { useMemo, useState } from "react";
import { BriefcaseBusiness, GraduationCap, House, Plus, ShoppingBag, Trash2, Users } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { Avatar, Checkbox, DateField, Modal, PrimaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import { todayISO } from "../lib/dates";

const GROUPS={home:{label:"Housework",Icon:House,tone:"violet",color:"#6b5ce7"},errand:{label:"Errands",Icon:ShoppingBag,tone:"green",color:"#3b8c75"},school:{label:"School",Icon:GraduationCap,tone:"slate",color:"#4b7ec5"},family:{label:"Family",Icon:Users,tone:"rose",color:"#d66b83"},work:{label:"Work",Icon:BriefcaseBusiness,tone:"amber",color:"#c98232"},personal:{label:"Personal",Icon:House,tone:"violet",color:"#756d8d"}};

export default function Tasks(){
 const {members,memberById,tasks,addTask,toggleTask,removeTask,clearTasks}=useFamily();
 const [clearing,setClearing]=useState(false);
 const [adding,setAdding]=useState(false); const [draft,setDraft]=useState({title:"",assigneeId:members[0]?.id||"",due:todayISO(),taskType:"home"});
 const open=tasks.filter(t=>!t.done); const grouped=useMemo(()=>open.reduce((a,t)=>{const k=t.taskType||"home";(a[k]??=[]).push(t);return a;},{}),[open]);
 const done=tasks.filter(t=>t.done).length, pct=tasks.length?Math.round(done/tasks.length*100):0;
 const save=async()=>{if(!draft.title.trim())return;await addTask({...draft,title:draft.title.trim(),recurring:""});setAdding(false);setDraft({...draft,title:""});};
 return <div className="pb-28 reference-tasks"><PageHeader title="Tasks" illustration="tasks" subtitle="Assign, track, and finish household tasks." action={tasks.length?<button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>:null}/><div className="px-5 space-y-5">
  {Object.entries(grouped).map(([key,items])=>{const meta=GROUPS[key]||GROUPS.home;const Icon=meta.Icon;return <section className={`task-board-group ${meta.tone}`} key={key}><div className="task-group-title"><h2><Icon/>{meta.label}</h2><span>{items.length} Task{items.length===1?"":"s"}</span></div><div className="task-board-list">{items.map(t=>{const person=memberById[t.assigneeId];return <div className="task-board-row" key={t.id}><Checkbox checked={t.done} onChange={()=>toggleTask(t.id)}/><div><strong>{t.title}</strong><small>Due {t.due===todayISO()?"Today":new Date(`${t.due}T12:00`).toLocaleDateString("en-CA",{weekday:"long"})}</small></div>{person&&<Avatar member={person}/>}<button className="task-row-delete" onClick={()=>removeTask(t.id)} aria-label={`Delete ${t.title}`}><Trash2/></button></div>})}</div></section>})}
  {open.length===0&&<section className="task-board-group violet"><div className="task-board-row"><strong>All clear. Beautiful.</strong></div></section>}
  <section className="weekly-progress"><h2>This week’s wins</h2><p>Your family has knocked out {pct}% of the list this week.</p><div><span style={{width:`${pct}%`}}/></div><small>{done} tasks done <b>{open.length} left</b></small></section>
  <button className="reference-fab" onClick={()=>setAdding(true)}><Plus/></button>
  </div><Modal open={adding} onClose={()=>setAdding(false)} title="Add a tiny mission"><TextField label="Task" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/><DateField label="Due date" value={draft.due} onChange={due=>setDraft({...draft,due})}/><p className="task-assignee-label">Category</p><div className="task-category-picker">{Object.entries(GROUPS).map(([key,meta])=><button key={key} className={draft.taskType===key?"selected":""} style={{"--task-color":meta.color}} onClick={()=>setDraft({...draft,taskType:key})}><i/>{meta.label}</button>)}</div><p className="task-assignee-label">Assign to</p><div className="task-assignee-picker">{members.map(member=><button key={member.id} className={draft.assigneeId===member.id?"selected":""} onClick={()=>setDraft({...draft,assigneeId:member.id})}><Avatar member={member}/><span>{member.name}</span></button>)}</div><PrimaryButton onClick={save}>Add it</PrimaryButton></Modal><Modal open={clearing} onClose={()=>setClearing(false)} title="Clear the task board?"><p className="reset-confirm-copy">This removes every task for the household. Great for a fresh start; not great for undoing.</p><div className="reset-confirm-actions"><button onClick={()=>setClearing(false)}>Cancel</button><PrimaryButton onClick={async()=>{await clearTasks();setClearing(false)}}>Clear all tasks</PrimaryButton></div></Modal></div>
}
