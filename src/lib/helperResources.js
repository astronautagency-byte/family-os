import { expandRecurringEvents } from './eventRecurrence';
export const isSchedule = r => ['calendar','family_calendar','event'].includes(r.kind);
export function helperResourceItems(resource,expiry,now=new Date()) {
 if(!isSchedule(resource))return resource.items||[];
 const start=new Date(now);start.setHours(0,0,0,0);
 const items=resource.kind==='event'?resource.items:expandRecurringEvents(resource.items||[],start,new Date(expiry));
 return (items||[]).filter(i=>new Date(i.end)>=start&&new Date(i.start)<=new Date(expiry)).sort((a,b)=>new Date(a.start)-new Date(b.start));
}
export function routineDay(timezone,now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone||'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;
}
