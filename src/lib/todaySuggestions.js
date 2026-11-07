/** One practical, local suggestion at a time. No household data leaves the device. */
export function todaySuggestions({tasks=[],meals=[],events=[],groceries=[],today,features={},hidden=[],dismissed=[],now=new Date()}) {
 const allowed=(feature,card=feature)=>features[feature]!==false&&!hidden.includes(card);
 const suggestions=[];
 if(allowed('calendar','schedule')) {
  const upcoming=events.filter(event=>{
   if(event.allDay || event.isAllDay || event.all_day || typeof event.start!=='string' || /^\d{4}-\d{2}-\d{2}$/.test(event.start)) return false;
   const delta=new Date(event.start).getTime()-now.getTime();
   return Number.isFinite(delta)&&delta>0&&delta<=2*60*60*1000;
  }).sort((a,b)=>new Date(a.start)-new Date(b.start))[0];
  if(upcoming) suggestions.push({id:`event:${upcoming.id||upcoming.start}`,page:'calendar',title:'Coming up soon',detail:upcoming.title||'An event is on your calendar',action:'View calendar',when:new Date(upcoming.start).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})});
 }
 const due=allowed('tasks')?tasks.filter(t=>!t.done && typeof t.due==='string' && /^\d{4}-\d{2}-\d{2}$/.test(t.due) && t.due<=today).sort((a,b)=>a.due.localeCompare(b.due)):[];
 if(due.length){const overdue=due.filter(t=>t.due<today).length;suggestions.push({id:'tasks-due',page:'tasks',title:overdue?`${overdue} overdue task${overdue===1?'':'s'} to review`:`${due.length} task${due.length===1?'':'s'} due today`,detail:due[0].title,action:'Review tasks'});}
 const unassigned=allowed('tasks')?tasks.filter(t=>!t.done&&!t.assigneeId&&(!Array.isArray(t.assigneeIds)||!t.assigneeIds.length)):[];
 if(unassigned.length) suggestions.push({id:'tasks-unassigned',page:'tasks',title:'Share the load',detail:`${unassigned.length} task${unassigned.length===1?' needs':'s need'} a person.`,action:'Review tasks'});
 const needed=allowed('groceries')?groceries.filter(item=>!item.checked):[];
 if(needed.length>=4) suggestions.push({id:'shopping',page:'groceries',title:'Your shopping list is taking shape',detail:`${needed.length} items are ready for your next shop.`,action:'View list'});
 if(allowed('meals')&&!meals.some(m=>m.date===today&&m.slot==='dinner')) suggestions.push({id:'dinner',page:'meals',title:'Make a plan for dinner',detail:'Choose something for tonight when you’re ready.',action:'Plan dinner'});
 return suggestions.find(item=>!dismissed.includes(item.id))||null;
}
