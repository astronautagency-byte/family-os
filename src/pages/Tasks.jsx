import { useMemo, useState } from "react";
import { BriefcaseBusiness, GraduationCap, House, Plus, ShoppingBag, Trash2, Users } from "lucide-react";
import { useFamily } from "../context/FamilyContext";
import { Avatar, Checkbox, DateField, Modal, PrimaryButton, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import PullToRefresh from "../components/PullToRefresh";
import ConfirmAction from "../components/ConfirmAction";
import { todayISO } from "../lib/dates";

const GROUPS={home:{label:"Housework",Icon:House,tone:"violet",color:"#6b5ce7"},errand:{label:"Errands",Icon:ShoppingBag,tone:"green",color:"#3b8c75"},school:{label:"School",Icon:GraduationCap,tone:"slate",color:"#4b7ec5"},family:{label:"Family",Icon:Users,tone:"rose",color:"#d66b83"},work:{label:"Work",Icon:BriefcaseBusiness,tone:"amber",color:"#c98232"},personal:{label:"Personal",Icon:House,tone:"violet",color:"#756d8d"}};

export default function Tasks(){
 const {members,memberById,tasks,addTask,toggleTask,updateTask,removeTask,clearTasks,refreshData}=useFamily();
 const [clearing,setClearing]=useState(false);
 const [editingId,setEditingId]=useState(null);
 const [draft,setDraft]=useState({title:"",assigneeId:members[0]?.id||"",due:todayISO(),taskType:"home"});
 const [inlineText,setInlineText]=useState("");
 const [showEditPanel,setShowEditPanel]=useState(false);

 const open=tasks.filter(t=>!t.done);
 const grouped=useMemo(()=>open.reduce((a,t)=>{const k=t.taskType||"home";(a[k]??=[]).push(t);return a;},{}),[open]);
 const done=tasks.filter(t=>t.done).length, pct=tasks.length?Math.round(done/tasks.length*100):0;

 // Inline creation — type, hit Enter, the task appears immediately without a modal.
 const submitInline=async(e)=>{e.preventDefault();if(!inlineText.trim())return;await addTask({title:inlineText.trim()});setInlineText("");};

 // Tapping a task row opens the detail editor for category, assignee, due date.
 const openEdit=(task)=>{setEditingId(task.id);setDraft({title:task.title,assigneeId:task.assigneeId||"",due:task.due||todayISO(),taskType:task.taskType||"home"});setShowEditPanel(true);};

 const save=async()=>{if(!draft.title.trim())return;await updateTask(editingId,{...draft,title:draft.title.trim()});setShowEditPanel(false);setEditingId(null);};

 return <PullToRefresh onRefresh={refreshData}><div className="pb-28 reference-tasks famos-noscroll"><PageHeader title="Tasks" illustration="tasks" subtitle="Assign, track, and finish household tasks." action={tasks.length?<button className="page-reset-button" onClick={()=>setClearing(true)}><Trash2/> Reset</button>:null}/><div className="px-5 space-y-5">
  {/* Inline input — iOS Reminders style: type and hit Enter, task appears */}
  <form className="task-inline-form" onSubmit={submitInline}>
    <span className="task-inline-icon"><Plus size={16}/></span>
    <input value={inlineText} onChange={e=>setInlineText(e.target.value)} placeholder="New task" className="task-inline-input" autoFocus aria-label="Add a new task" />
  </form>

  {Object.entries(grouped).map(([key,items])=>{const meta=GROUPS[key]||GROUPS.home;const Icon=meta.Icon;return <section className={`task-board-group ${meta.tone}`} key={key}><div className="task-group-title"><h2><Icon/>{meta.label}</h2><span>{items.length} Task{items.length===1?"":"s"}</span></div><div className="task-board-list">{items.map(t=>{const person=memberById[t.assigneeId];const dueLabel=t.due===todayISO()?"Today":t.due?new Date(`${t.due}T12:00`).toLocaleDateString("en-CA",{weekday:"short"}):null;const categoryLabel=t.taskType?GROUPS[t.taskType]?.label||t.taskType:null;return <div className="task-board-row" key={t.id}><Checkbox checked={t.done} onChange={()=>toggleTask(t.id)}/><button className="task-row-copy" onClick={()=>openEdit(t)}><strong>{t.title}</strong><small>{[dueLabel,categoryLabel].filter(Boolean).join(" · ")}</small></button>{person&&<Avatar member={person} size="sm"/>}<button className="task-row-delete" onClick={()=>removeTask(t.id)} aria-label={`Delete ${t.title}`}><Trash2/></button></div>})}</div></section>})}
  {open.length===0&&<section className="task-board-group violet"><div className="task-board-row"><strong>All clear. Type above to add a task.</strong></div></section>}
  <section className="weekly-progress"><h2>This week’s wins</h2><p>Your family has knocked out {pct}% of the list this week.</p><div><span style={{width:`${pct}%`}}/></div><small>{done} tasks done <b>{open.length} left</b></small></section>
  </div>

  {/* Detail editor — opens when a task row is tapped */}
  <Modal open={showEditPanel} onClose={()=>setShowEditPanel(false)} title={editingId?"Edit task":"Add task"}><TextField label="Task" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/><DateField label="Due date" value={draft.due} onChange={due=>setDraft({...draft,due})}/><p className="task-assignee-label">Category</p><div className="task-category-picker">{Object.entries(GROUPS).map(([key,meta])=><button key={key} className={draft.taskType===key?"selected":""} style={{"--task-color":meta.color}} onClick={()=>setDraft({...draft,taskType:key})}><i/>{meta.label}</button>)}</div><p className="task-assignee-label">Assign to</p><div className="task-assignee-picker">{members.map(member=><button key={member.id} className={draft.assigneeId===member.id?"selected":""} onClick={()=>setDraft({...draft,assigneeId:member.id})}><Avatar member={member}/><span>{member.name}</span></button>)}</div><PrimaryButton onClick={save}>Save changes</PrimaryButton></Modal>

  <ConfirmAction open={clearing} onClose={()=>setClearing(false)} onConfirm={async()=>{await clearTasks();setClearing(false)}} title={tasks.length===1?"Clear the 1 task?":`Clear all ${tasks.length} tasks?`} copy={tasks.length===1?"This removes the 1 task on the board.":`This removes all ${tasks.length} tasks from the board.`} confirmLabel={tasks.length===1?"Clear 1 task":`Clear all ${tasks.length} tasks`}/>
 </div></PullToRefresh>;
}
