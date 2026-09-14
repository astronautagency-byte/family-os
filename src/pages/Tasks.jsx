import { useMemo, useState, useCallback } from "react";
import { BriefcaseBusiness, Check, GraduationCap, House, Layers3, ListPlus, ListTodo, Plus, Share2, ShoppingBag, Trash2, Users } from "../components/icons";
import { useFamily } from "../context/FamilyContext";
import { Alert, Avatar, AvatarStack, Badge, Checkbox, DateField, EmptyState, Modal, PrimaryButton, ProgressBar, TextAreaField, TextField } from "../components/ui";
import PageHeader from "../components/PageHeader";
import usePageAdd from '../hooks/usePageAdd';
import PullToRefresh from "../components/PullToRefresh";
import ConfirmAction from "../components/ConfirmAction";
import NativeAdBanner from "../components/NativeAdBanner";
import { AD_PLACEMENTS } from "../lib/adNetwork";
import { todayISO } from "../lib/dates";
import { buildShareUrl } from "../lib/share";
import ShareSheet from "../components/ShareSheet";
import { fireConfetti } from "../lib/confetti";
import CompletionScreen from '../components/CompletionScreen';


const GROUPS={home:{label:"Housework",Icon:House,tone:"violet",color:"#6b5ce7"},errand:{label:"Errands",Icon:ShoppingBag,tone:"green",color:"#3b8c75"},school:{label:"School",Icon:GraduationCap,tone:"slate",color:"#4b7ec5"},family:{label:"Family",Icon:Users,tone:"rose",color:"#d66b83"},work:{label:"Work",Icon:BriefcaseBusiness,tone:"amber",color:"#c98232"},personal:{label:"Personal",Icon:House,tone:"violet",color:"#756d8d"}};
const LIST_COLORS=[{value:"#6b5ce7",label:"Violet"},{value:"#d66b83",label:"Rose"},{value:"#b95f3b",label:"Coral"},{value:"#c98232",label:"Amber"},{value:"#3b8c75",label:"Green"},{value:"#2f8b9d",label:"Teal"},{value:"#4b7ec5",label:"Blue"},{value:"#756d8d",label:"Slate"}];

export default function Tasks(){
 const {members:rawMembers,memberById:rawMemberById,tasks:rawTasks,taskLists:rawTaskLists,addTaskList,removeTaskList,addTask,toggleTask: persistToggleTask,updateTask,removeTask,clearTasks,refreshData}=useFamily();
 const [taskCelebration,setTaskCelebration]=useState(false);

 const toggleTask=async(id)=>{const task=rawTasks?.find(item=>item.id===id);const saved=await persistToggleTask(id);if(saved&&task&&!task.done&&rawTasks.filter(item=>!item.done).length===1)setTaskCelebration(true);};
 const members=Array.isArray(rawMembers)?rawMembers:[];
 const memberById=rawMemberById&&typeof rawMemberById==="object"?rawMemberById:{};
 const tasks=Array.isArray(rawTasks)?rawTasks:[];
 const taskLists=Array.isArray(rawTaskLists)?rawTaskLists:[];
 const [clearing,setClearing]=useState(false);
 const [editingId,setEditingId]=useState(null);
 const [draft,setDraft]=useState({title:"",notes:"",assigneeIds:members[0]?.id?[members[0].id]:[],due:todayISO(),taskType:"home",listId:null});
 const [inlineText,setInlineText]=useState("");
 const [inlineSaving,setInlineSaving]=useState(false);
 const [inlineError,setInlineError]=useState("");
 const [statusFilter,setStatusFilter]=useState("open");
 const [search,setSearch]=useState("");
 const [deletingTask,setDeletingTask]=useState(null);
 const [showEditPanel,setShowEditPanel]=useState(false);
 const [showListPanel,setShowListPanel]=useState(false);
 const [listDraft,setListDraft]=useState({name:"",color:"#6b5ce7"});
 const [listError,setListError]=useState("");
 const [listSaving,setListSaving]=useState(false);
 const [activeList,setActiveList]=useState("all");
 const [taskSaving,setTaskSaving]=useState(false);
 const [taskSaveError,setTaskSaveError]=useState("");
 const [deletingList,setDeletingList]=useState(null);

 const open=tasks.filter(t=>!t.done);
 const filteredTasks=tasks.filter(task=>(statusFilter==="completed"?task.done:!task.done) && `${task.title||""} ${task.notes||""}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"));
 const grouped=useMemo(()=>filteredTasks.reduce((a,t)=>{const k=t.listId?`list:${t.listId}`:t.taskType||"home";(a[k]??=[]).push(t);return a;},{}),[filteredTasks]);
 const groupEntries=useMemo(()=>{
   const entries=Object.entries(grouped);
   for(const list of taskLists){
     if(!list?.id)continue;
     const key=`list:${list.id}`;
     if(!entries.some(([id])=>id===key))entries.push([key,[]]);
   }
   return entries;
 },[grouped,taskLists]);
 const listOptions=useMemo(()=>[
   {id:"all",label:"All tasks",Icon:Layers3,color:"var(--color-tasks)",count:filteredTasks.length},
   ...Object.entries(GROUPS).map(([id,meta])=>({id,label:meta.label,Icon:meta.Icon,color:meta.color,count:grouped[id]?.length||0})),
   ...taskLists.filter((list)=>list?.id).map(list=>({id:`list:${list.id}`,label:list.name||"Untitled list",Icon:ListTodo,color:list.color||"var(--color-tasks)",count:grouped[`list:${list.id}`]?.length||0}))
 ],[filteredTasks.length,grouped,taskLists]);
 const visibleGroupEntries=useMemo(()=>activeList==="all"?groupEntries:[[activeList,grouped[activeList]||[]]],[activeList,groupEntries,grouped]);
 const done=tasks.filter(t=>t.done).length, pct=tasks.length?Math.round(done/tasks.length*100):0;

 // Inline creation — type, hit Enter, the task appears immediately without a modal.
 const submitInline=async(e)=>{e.preventDefault();if(!inlineText.trim()||inlineSaving)return;setInlineSaving(true);setInlineError("");const target=activeList.startsWith("list:")?{listId:activeList.slice(5)}:activeList!=="all"?{taskType:activeList}:{};try{await addTask({title:inlineText.trim(),...target});setInlineText("");setStatusFilter("open");setSearch("");}catch(error){setInlineError(error?.message||"Could not save this task. Your text is still here—try again.");}finally{setInlineSaving(false);}};

 // Tapping a task row opens the detail editor for category, assignee, due date.
 const openEdit=(task)=>{setEditingId(task.id);setDraft({title:task.title,notes:task.notes||"",assigneeIds:task.assigneeIds?.length?task.assigneeIds:task.assigneeId?[task.assigneeId]:[],due:task.due||todayISO(),taskType:task.taskType||"home",listId:task.listId||null});setTaskSaveError("");setShowEditPanel(true);};

 const openNewTask=()=>{setEditingId(null);setDraft({title:"",notes:"",assigneeIds:[],due:todayISO(),taskType:activeList!=="all"&&!activeList.startsWith("list:")?activeList:"home",listId:activeList.startsWith("list:")?activeList.slice(5):null});setTaskSaveError("");setShowEditPanel(true);};
 usePageAdd('tasks', openNewTask);
 const save=async()=>{if(!draft.title.trim()||taskSaving)return;setTaskSaving(true);setTaskSaveError("");try{const payload={...draft,title:draft.title.trim()};if(editingId)await updateTask(editingId,payload);else await addTask(payload);setShowEditPanel(false);setEditingId(null);}catch(error){setTaskSaveError(error?.message||"This task could not be saved. Try again.");}finally{setTaskSaving(false);}};
 const saveList=async()=>{if(!listDraft.name.trim()||listSaving)return;setListSaving(true);setListError("");try{const list=await addTaskList(listDraft);if(!list)throw new Error("Could not create this list.");setListDraft({name:"",color:"#6b5ce7"});setShowListPanel(false);setDraft((current)=>({...current,listId:list.id}));setActiveList(`list:${list.id}`);}catch(error){setListError(error?.message||"Could not create this list. Try again.");}finally{setListSaving(false);}};

 const [shareSheet,setShareSheet]=useState(null);
 const shareTask=(task)=>{if(!task?.id)return;const due=task.due===todayISO()?"today":task.due?new Date(`${task.due}T12:00`).toLocaleDateString("en-CA",{weekday:"short",month:"short",day:"numeric"}):"whenever it fits";setShareSheet({title:task.title,text:`Due: ${due}`,url:buildShareUrl("task",task.id),image:"/banners/banner-tasks.jpg",imageAlt:task.title});};
 const shareList=(key,items)=>{const custom=key.startsWith("list:")?taskLists.find(list=>list.id===key.slice(5)):null;const label=custom?.name||GROUPS[key]?.label||key;if(!items.length){setShareSheet({title:`${label} · FamOS tasks`,text:"This list is empty — add a task and share it with your family.",url:buildShareUrl("task",`list-${custom?.id||key}`),image:"/banners/banner-tasks.jpg",imageAlt:label});return;}const lines=items.slice(0,25).map((t,index)=>`${index+1}. ${t.title}${t.due?` (${t.due===todayISO()?"today":new Date(`${t.due}T12:00`).toLocaleDateString("en-CA",{weekday:"short",month:"short",day:"numeric"})})`:``}`).join("\n");setShareSheet({title:`${label} · ${items.length} task${items.length===1?"":"s"}`,text:lines,url:buildShareUrl("task",`list-${custom?.id||key}`),image:"/banners/banner-tasks.jpg",imageAlt:label});};

  return <PullToRefresh onRefresh={refreshData}><div className="reference-tasks"><PageHeader title="Tasks" onAdd={openNewTask} addLabel="Add task"/><NativeAdBanner placement={AD_PLACEMENTS.TASKS}/><div className="px-5"><div className="task-toolbar"><button className="task-toolbar-btn" onClick={()=>setShowListPanel(true)}><ListPlus size={16}/> New list</button>{tasks.length>0&&<button className="task-toolbar-btn task-toolbar-reset" onClick={()=>setClearing(true)}><Trash2 size={16}/> Reset</button>}</div><div className="space-y-5">
  {/* Inline input — iOS Reminders style: type and hit Enter, task appears */}
 <form className="task-inline-form" onSubmit={submitInline}>
    <span className="task-inline-icon"><Plus size={16}/></span>
    <input value={inlineText} onChange={e=>setInlineText(e.target.value)} placeholder="What needs doing?" className="task-inline-input" disabled={inlineSaving} aria-describedby={inlineError?"task-inline-error":undefined} aria-label="Add a new task" />
    <button type="submit" className="task-inline-submit" disabled={inlineSaving||!inlineText.trim()}>{inlineSaving?"Adding…":"Add"}</button>
  </form>
  {inlineError&&<p id="task-inline-error" role="alert" className="task-inline-error">{inlineError}</p>}
  <div className="task-filter-row"><div className="reference-segments" role="group" aria-label="Task status">{[["open","To do"],["completed","Completed"]].map(([id,label])=><button type="button" key={id} aria-pressed={statusFilter===id} onClick={()=>setStatusFilter(id)}>{label}</button>)}</div><input type="search" className="task-search" aria-label="Search tasks" placeholder="Search tasks" value={search} onChange={e=>setSearch(e.target.value)}/></div>

  <div className="task-list-switcher" role="tablist" aria-label="Task lists">
    {listOptions.map(({id,label,Icon,color,count})=>id.startsWith("list:")?<div className={`task-list-tab ${activeList===id?"selected":""}`} style={{"--list-tone":color}} key={id}><button type="button" role="tab" aria-selected={activeList===id} onClick={()=>setActiveList(id)}><Icon size={15}/><span>{label}</span><em>{count}</em></button><button type="button" className="task-list-delete" onClick={()=>setDeletingList(taskLists.find(list=>`list:${list.id}`===id))} aria-label={`Delete ${label}`}><Trash2 size={13}/></button></div>:<button type="button" role="tab" aria-selected={activeList===id} className={activeList===id?"selected":""} style={{"--list-tone":color}} onClick={()=>setActiveList(id)} key={id}><Icon size={15}/><span>{label}</span><em>{count}</em></button>)}
  </div>

  {visibleGroupEntries.map(([key,items])=>{const custom=key.startsWith("list:")?taskLists.find(list=>list.id===key.slice(5)):null;const meta=custom?{label:custom.name||"Untitled list",Icon:ListTodo,tone:"custom",color:custom.color||"var(--color-tasks)"}:GROUPS[key]||GROUPS.home;const Icon=meta.Icon;return <section className={`task-board-group ${meta.tone}`} style={custom?{"--custom-list-color":custom.color||"var(--color-tasks)"}:undefined} key={key}><div className="task-group-title"><h2><Icon/><span className="task-group-name">{meta.label}</span></h2><Badge tone="accent">{items.length} Task{items.length===1?"":"s"}</Badge><button className="task-list-share" onClick={()=>shareList(key,items)} aria-label={`Share ${meta.label}`} title="Share this list"><Share2 size={14}/></button></div><div className="task-board-list">{items.length?items.map(t=>{const people=(t.assigneeIds?.length?t.assigneeIds:t.assigneeId?[t.assigneeId]:[]).map(id=>memberById[id]).filter(Boolean);const overdue=!t.done&&t.due&&t.due<todayISO();const dueLabel=t.due===todayISO()?"Today":t.due?`${overdue?"Overdue · ":""}${new Date(`${t.due}T12:00`).toLocaleDateString("en-CA",{month:"short",day:"numeric"})}`:null;const categoryLabel=custom?.name||(t.taskType?GROUPS[t.taskType]?.label||t.taskType:null);return <div className="task-board-row" key={t.id}><Checkbox checked={t.done} onChange={()=>toggleTask(t.id)} label={`${t.done?"Reopen":"Complete"} ${t.title||"task"}`}/><button className="task-row-copy" onClick={()=>openEdit(t)}><strong>{t.title||"Untitled task"}</strong><small className={overdue?"task-overdue":undefined}>{[dueLabel,categoryLabel].filter(Boolean).join(" · ")}</small></button>{people.length>0&&<AvatarStack members={people} size="sm" max={3} label={`Assigned to ${people.map(person=>person.name).join(", ")}`}/>}<div className="task-row-actions"><button className="task-row-share" onClick={()=>shareTask(t)} aria-label={`Share ${t.title||"task"}`} title="Share with the family"><Share2 size={15}/></button><button className="task-row-delete" onClick={()=>setDeletingTask(t)} aria-label={`Delete ${t.title||"task"}`}><Trash2/></button></div></div>}):<EmptyState title={search?"No matching tasks":statusFilter==="completed"?"No completed tasks here":"This list is clear"} subtitle={search?"Try a different word or clear your search.":"Tasks stay organised here so your family can find them."} actionLabel={search?"Clear search":statusFilter==="open"?"Add task":undefined} onAction={search?()=>setSearch(""):openNewTask}/>}</div></section>})}
  {activeList==="all"&&visibleGroupEntries.length===0&&<EmptyState icon={<ListTodo size={32}/>} title={search?"No matching tasks":statusFilter==="completed"?"No completed tasks yet":"You’re all caught up"} subtitle={search?"Try another word.":"Add a task, choose a due date, and share the responsibility."} actionLabel={search?"Clear search":statusFilter==="open"?"Add task":undefined} onAction={search?()=>setSearch(""):openNewTask}/>}
  <section className="weekly-progress"><h2>Your family’s progress</h2><p>Your family has knocked out {pct}% of your tasks.</p><ProgressBar value={done} max={tasks.length || 1} color="var(--color-accent)" size="lg"/><small>{done} tasks done <b>{open.length} left</b></small></section>
  </div></div>

  {/* Detail editor — opens when a task row is tapped */}
  {taskCelebration && <CompletionScreen onClose={() => setTaskCelebration(false)}/>}
  <Modal open={showEditPanel} onClose={()=>{if(!taskSaving){setShowEditPanel(false);setTaskSaveError("");}}} title={editingId?"Edit task":"Add task"}><TextField label="Task" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/><TextAreaField label="Notes (optional)" value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Add instructions, links, or helpful details"/><DateField label="Due date" value={draft.due} onChange={due=>setDraft({...draft,due})}/><p className="task-assignee-label">List</p><div className="task-category-picker">{Object.entries(GROUPS).map(([key,meta])=><button type="button" key={key} className={!draft.listId&&draft.taskType===key?"selected":""} style={{"--task-color":meta.color}} onClick={()=>setDraft({...draft,taskType:key,listId:null})}><i/>{meta.label}</button>)}{taskLists.map(list=><button type="button" key={list.id} className={draft.listId===list.id?"selected":""} style={{"--task-color":list.color}} onClick={()=>setDraft({...draft,listId:list.id})}><i/>{list.name}</button>)}</div><p className="task-assignee-label">Assign to <small>Choose one or more</small></p><div className="task-assignee-picker">{members.map(member=>{const selected=draft.assigneeIds.includes(member.id);return <button type="button" key={member.id} aria-pressed={selected} className={selected?"selected":""} onClick={()=>setDraft({...draft,assigneeIds:selected?draft.assigneeIds.filter(id=>id!==member.id):[...draft.assigneeIds,member.id]})}><Avatar member={member}/><span>{member.name}</span>{selected&&<Check size={14}/>}</button>})}</div>{taskSaveError&&<Alert tone="error" className="mb-3">{taskSaveError}</Alert>}<PrimaryButton onClick={save} disabled={taskSaving||!draft.title.trim()}>{taskSaving?"Saving…":editingId?"Save changes":"Add task"}</PrimaryButton></Modal>

  <Modal open={showListPanel} onClose={()=>{if(!listSaving){setShowListPanel(false);setListError("");}}} title="New task list"><TextField label="List name" value={listDraft.name} onChange={e=>setListDraft({...listDraft,name:e.target.value})} placeholder="Vacation prep"/><div className="task-list-color"><span>List colour</span><div className="task-list-swatches" role="radiogroup" aria-label="List colour">{LIST_COLORS.map(({value,label})=><button key={value} type="button" role="radio" aria-checked={listDraft.color===value} aria-label={label} title={label} className={`task-list-swatch${listDraft.color===value?" selected":""}`} style={{"--swatch-color":value}} onClick={()=>setListDraft({...listDraft,color:value})}><Check aria-hidden="true"/></button>)}</div><strong style={{color:listDraft.color}}>{listDraft.name||"New list"}</strong></div>{listError&&<Alert tone="error" className="mb-3">{listError}</Alert>}<PrimaryButton onClick={saveList} disabled={!listDraft.name.trim()||listSaving}>{listSaving?"Creating…":"Create list"}</PrimaryButton></Modal>

  <ConfirmAction open={!!deletingTask} onClose={()=>setDeletingTask(null)} onConfirm={async()=>{await removeTask(deletingTask.id);setDeletingTask(null);}} title="Delete this task?" copy={`“${deletingTask?.title||"Untitled task"}” will be removed for your family.`} confirmLabel="Delete task"/>
  <ConfirmAction open={clearing} onClose={()=>setClearing(false)} onConfirm={async()=>{await clearTasks();setClearing(false)}} title={tasks.length===1?"Clear the 1 task?":`Clear all ${tasks.length} tasks?`} copy={tasks.length===1?"This removes the 1 task on the board.":`This removes all ${tasks.length} tasks from the board.`} confirmLabel={tasks.length===1?"Clear 1 task":`Clear all ${tasks.length} tasks`}/>
  <ConfirmAction open={!!deletingList} onClose={()=>setDeletingList(null)} onConfirm={async()=>{const id=deletingList?.id;if(!id)return;await removeTaskList(id);if(activeList===`list:${id}`)setActiveList("all");setDeletingList(null)}} title={`Delete ${deletingList?.name||"this list"}?`} copy="The list will be removed. Its tasks will stay available under All tasks so nothing is lost." confirmLabel="Delete list" />
  <ShareSheet open={!!shareSheet} onClose={()=>setShareSheet(null)} title={shareSheet?.title} text={shareSheet?.text} url={shareSheet?.url} image={shareSheet?.image} imageAlt={shareSheet?.imageAlt}/>
 </div></PullToRefresh>;
}
