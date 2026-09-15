export const ROUTINE_CADENCES = ['daily', 'weekdays', 'weekly', 'monthly'];
export function getRoutinePrompts({members=[],tasks=[],events=[]}={}) {
  const schoolFamily=members.some(member=>/kid|child|teen/i.test(member.role || '')) || events.some(event=>/school|pickup|drop.off/i.test(event.title || ''));
  const candidates=[
    ...(schoolFamily?[{title:'School morning',text:'Suggest a school-morning routine using our schedule, for me to review'}]:[]),
    {title:'Weekly reset',text:'Suggest a weekly household reset routine based on our open tasks'},
  ];
  return candidates.filter(candidate=>!tasks.some(task=>!task.done && task.recurring?.startsWith('routine:') && task.title?.toLowerCase().includes(candidate.title.toLowerCase()))).map(({text})=>({text,tone:'tasks'}));
}
export function validateRoutine(args, members = []) {
  const title = String(args.title || '').trim();
  const steps = Array.isArray(args.steps) ? args.steps.map(step => String(step).trim()).filter(Boolean) : [];
  if (!title || title.length > 200) throw Error('Give the routine a title of 1–200 characters.');
  if (!ROUTINE_CADENCES.includes(args.cadence)) throw Error('Choose daily, weekdays, weekly, or monthly.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.start_date || '') || new Date(`${args.start_date}T12:00:00Z`).toISOString().slice(0,10) !== args.start_date) throw Error('Choose a valid start date.');
  if (!steps.length || steps.length > 12 || steps.some(step=>step.length>300)) throw Error('Add 1–12 short routine steps.');
  const name = String(args.assignee_name || '').trim();
  const matches = name ? members.filter(member=>member.name?.toLowerCase() === name.toLowerCase()) : [];
  if (name && matches.length !== 1) throw Error('Choose an existing family member, or leave the routine unassigned.');
  return {title, notes:steps.map((step,index)=>`${index+1}. ${step}`).join('\n'), recurring:`routine:${args.cadence}`, due:args.start_date, assigneeId:matches[0]?.id || null, assigneeIds:matches.length?[matches[0].id]:[], taskType:'home'};
}
export function nextRoutineDate(date, recurrence) {
  const cadence=recurrence?.replace('routine:','');
  if (!recurrence?.startsWith('routine:') || !ROUTINE_CADENCES.includes(cadence) || !date) return null;
  const next=new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(next.getTime())) return null;
  if(cadence==='monthly'){
    const day=next.getUTCDate(); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth()+1);
    const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate(); next.setUTCDate(Math.min(day,last));
  }else{
    next.setUTCDate(next.getUTCDate()+(cadence==='weekly'?7:1));
    if(cadence==='weekdays')while([0,6].includes(next.getUTCDay()))next.setUTCDate(next.getUTCDate()+1);
  }
  return next.toISOString().slice(0,10);
}
