import {useState} from 'react';
import { Card } from './ui';
import { helperResourceItems,isSchedule } from '../lib/helperResources';
import { RESOURCE_LABELS } from '../lib/familyHelpers';
export default function HelperResources({resources,expiry,busy,onComplete}){
 const groups=[['Schedules',resources.filter(isSchedule)],['Lists & routines',resources.filter(r=>!isSchedule(r))]].filter(([,r])=>r.length);
 const [view,setView]=useState(()=>resources.some(r=>!isSchedule(r))?'Lists & routines':'Schedules');
 const selected=groups.some(([name])=>name===view)?view:groups[0]?.[0];
 return <div className="helper-resource-sections">{groups.length>1&&<div className="helper-view-switch" role="group" aria-label="Shared views">{groups.map(([name])=><button type="button" key={name} aria-pressed={selected===name} onClick={()=>setView(name)}>{name}</button>)}</div>}{groups.filter(([name])=>name===selected).map(([heading,group])=><section key={heading}><h2>{heading}</h2>{group.map(r=>{
  const schedule=isSchedule(r),routine=r.routine_cadence&&r.routine_cadence!=='none';const items=helperResourceItems(r,expiry);
  return <Card className="p-4 family-helper-card" key={r.grant_id}><h3>{r.name}</h3><small>{schedule?'Shared schedule · View only':routine?`${r.routine_cadence==='weekdays'?'Weekday':'Daily'} routine · ${r.permission==='complete'?'Check off today’s tasks':'View instructions'}`:`${RESOURCE_LABELS[r.kind]} · ${r.permission==='complete'?'You can check off items':'View only'}`}</small>
   {routine&&<p>For today, {r.routine_day}. Completed tasks return on the next scheduled day.</p>}
   <ul className="family-helper-items">{items.map(item=><li key={item.id}>{schedule?<div><strong>{item.title}</strong><p>{new Date(item.start).toLocaleString()} – {new Date(item.end).toLocaleString()}</p></div>:<div className="helper-checklist-item">{r.permission==='complete'?<label><input type="checkbox" checked={!!item.done} disabled={busy} onChange={()=>onComplete(r,item)}/><span>{item.title}</span></label>:<strong>{item.title}</strong>}{item.due&&!routine&&<small>Due {item.due}</small>}{item.notes&&<p className="helper-task-instructions">{item.notes}</p>}</div>}</li>)}</ul>
   {!items.length&&<p>{schedule?'No upcoming events in this shared schedule.':routine?'No routine tasks due today.':'No shared items.'}</p>}
   {routine&&items.length>0&&items.every(i=>i.done)&&<p>All done for today. This routine is ready again on its next scheduled day.</p>}
  </Card>;
 })}</section>)}</div>;
}
