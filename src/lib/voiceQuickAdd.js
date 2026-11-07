import * as chrono from 'chrono-node';
export const capitalizeFirstWord = value => String(value || '').trim().replace(/^(\P{L}*)(\p{L})/u, (_, prefix, letter) => prefix + letter.toLocaleUpperCase());
const localInput = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const normalize = input => String(input || '').trim().replace(/[.!?]+$/, '').trim().replace(/^(?:(?:hey\s+(?:famos|mia)|famos|mia)[,\s]+)?(?:(?:can|could|would) you\s+|(?:i'd|i would) like you to\s+)?(?:please\s+)?/i, '').replace(/\s+please$/i, '').trim();
/** Interpret explicit additions only. Ambiguous destinations and schedules are not guessed. */
export function parseVoiceQuickAdd(input, { groceryLists = [], taskLists = [], now = new Date() } = {}) {
  const text = normalize(input);
  let match = text.match(/^(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:my\s+|the\s+|our\s+)?(?:grocery|groceries|shopping)(?:\s+list)?$/i);
  if (match) return { type: 'grocery', name: match[1].trim().slice(0,120) };
  match = text.match(/^(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:my\s+|the\s+|our\s+)?(.+?)\s+list$/i);
  if (match) { const needle = match[2].trim().toLowerCase(); const choices = [...groceryLists.map(x=>({...x,type:'grocery'})),...taskLists.map(x=>({...x,type:'task'}))].filter(x=>x.name?.trim().toLowerCase()===needle); if (choices.length === 1) return {type:choices[0].type,name:match[1].trim().slice(0,120),listId:choices[0].id,listName:choices[0].name}; return null; }
  match = text.match(/^(?:add|create|make)\s+(?:a\s+)?task(?:\s+(?:to|called|named))?\s+(.+)$/i);
  if (match) return {type:'task',name:match[1].trim().slice(0,120)};
  match = text.match(/^(?:create|make|add)\s+(?:a\s+)?(shopping|grocery|task)\s+list\s+(?:called|named)\s+(.+)$/i);
  if (match) return {type:match[1].toLowerCase()==='task'?'taskList':'groceryList',name:match[2].trim().slice(0,120)};
  match=text.match(/^(?:plan|add|schedule)\s+(.+?)\s+(?:for|as)\s+(breakfast|lunch|dinner)(?:\s+(.*))?$/i);
  if(match){const day=match[3]?chrono.parse(match[3],now,{forwardDate:true})[0]:null;const date=day&&(day.start.isCertain('day')||day.start.isCertain('weekday'))?localInput(day.start.date()).slice(0,10):'';return {type:'meal',name:match[1].trim().slice(0,120),slot:match[2].toLowerCase(),date};}
  if (/^(?:add|create|schedule|put)\s+/i.test(text) && /\b(?:calendar|event|appointment)\b/i.test(text)) {
    if (/\bevery\s+other\b|\bbiweekly\b|\bweekdays\b|\bevery\s+\d+\b|\buntil\b|\bthrough\b/i.test(text)) return null;
    const parsed=chrono.parse(text,now,{forwardDate:true})[0];
    let title=text.replace(/^(?:add|create|schedule|put)\s+(?:an?\s+)?/i,'');
    title=title.replace(/^event(?:\s+(?:for|called|named))?\s+/i,'');
    const afterDate=parsed && !parsed.start.isCertain('hour') ? text.slice(parsed.index+parsed.text.length).match(/^\s+(?:at\s+)?(\d{3,4})(?=\s|$)/i) : null;
    // A leading compact time in an explicit event request is common dictation
    // ("add 330 haircut ..."). A named title such as "Room 330" is untouched.
    const leading=title.match(/^(\d{3,4})(?=\s|$)/);
    const atTime=title.match(/\bat\s+(\d{3,4})(?=\s|$)/i);
    const compact=afterDate || leading || atTime;
    const digits=compact?.[1] || '', compactHour=Number(digits.slice(0,-2)), compactMinute=Number(digits.slice(-2));
    const validCompact=!!digits && compactHour>=1 && compactHour<=23 && compactMinute<60;
    if(parsed) title=title.replace(parsed.text,'');
    if(validCompact) {
      if(leading) title=title.replace(/^\d{3,4}\s*/, '');
      else if(atTime) title=title.replace(atTime[0], '');
      else title=title.replace(new RegExp(`\\b${digits}\\b`),'');
    }
    title=title.replace(/\b(?:as\s+an?\s+event|(?:to|on|in|into)\s+(?:(?:my|the|our)\s+)?(?:(?:family\s+)?calendar|events?(?:\s+(?:for|on|in)\s+(?:(?:my|the|our)\s+)?calendar)?)|event\s+(?:called|named))\b/ig,'').replace(/\b(?:every|each|on|at|for)\s*$/i,'').replace(/\s+/g,' ').trim();
    if(!title) return null;
    let recurrence='none'; if(/\b(?:every|each)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b/i.test(text))recurrence='weekly';else if(/\b(?:every|each)\s+day\b|\bdaily\b/i.test(text))recurrence='daily';else if(/\b(?:every|each)\s+month\b|\bmonthly\b/i.test(text))recurrence='monthly';else if(/\b(?:every|each)\s+year\b|\byearly\b/i.test(text))recurrence='yearly';else if(/\b(?:every|each)\b/i.test(text))return null;
    const hasDate=parsed && (parsed.start.isCertain('day') || parsed.start.isCertain('weekday'));
    const hasTime=parsed?.start.isCertain('hour');
    const hour=hasTime?parsed.start.get('hour'):validCompact?compactHour:null;
    const minute=hasTime?parsed.start.get('minute')||0:validCompact?compactMinute:0;
    const time=hour===null?null:{hour,minute,period:hasTime && parsed.start.isCertain('meridiem') ? (hour>=12?'pm':'am') : null};
    return scheduleVoiceEvent({type:'event',name:capitalizeFirstWord(title.slice(0,120)),start:'',end:'',recurrence},hasDate?localInput(parsed.start.date()).slice(0,10):'',time,parsed?.end?.date());
  }
  return null;
}
export function parseVoiceConfirmation(input) { const text=String(input||'').trim().toLowerCase().replace(/[.!?,]+/g,'').trim(); if(/^(yes|yeah|yep|confirm|yes please|go ahead|do it)$/.test(text))return 'yes';if(/^(no|nope|cancel|not now|don't|do not)$/.test(text))return 'no';return null; }

/** Resolve an explicitly ambiguous 12-hour time only after the user chooses AM or PM. */
export function resolveVoicePeriod(action, period) {
  const t=action?.ambiguousTime;if(!t || !['am','pm'].includes(period))return action;
  const hour=(t.hour%12)+(period==='pm'?12:0);const date=new Date(`${t.date}T${String(hour).padStart(2,'0')}:${String(t.minute).padStart(2,'0')}:00`);
  if(!Number.isFinite(date.getTime()) || date.getHours()!==hour || date.getMinutes()!==t.minute)return action;
  return {...action,start:localInput(date),end:localInput(new Date(date.getTime()+60*60*1000)),assumedDuration:true,ambiguousTime:null,pendingTime:null,eventDate:t.date};
}

export function parseVoicePeriod(input) { const text=String(input||'').toLowerCase().replace(/[.\s]/g,'');if(['am','morning','inthemorning'].includes(text))return 'am';if(['pm','afternoon','evening','intheafternoon','intheevening'].includes(text))return 'pm';return null; }


function scheduleVoiceEvent(action,date,time,explicitEnd) {
  const clean={...action,start:'',end:'',eventDate:date,pendingTime:time,ambiguousTime:null};
  if(!date || !time)return clean;
  if(time.hour>=1 && time.hour<=12 && !time.period) return {...clean,ambiguousTime:{date,hour:time.hour,minute:time.minute}};
  const hour=time.period ? time.hour%12+(time.period==='pm'?12:0) : time.hour;
  const start=new Date(`${date}T${String(hour).padStart(2,'0')}:${String(time.minute).padStart(2,'0')}:00`);
  if(!Number.isFinite(start.getTime()) || start.getHours()!==hour)return clean;
  return {...clean,start:localInput(start),end:localInput(explicitEnd || new Date(start.getTime()+3600000)),pendingTime:null,assumedDuration:!explicitEnd};
}

/** Merge a short answer into the existing draft; never invent a day or period. */
export function resolveVoiceFollowup(action,input,{now=new Date()}={}) {
  if(action?.type!=='event')return null;
  const parsed=chrono.parse(String(input),now,{forwardDate:true})[0];
  let date=action.ambiguousTime?.date || action.start?.slice(0,10) || action.eventDate || '';
  let time=action.pendingTime || (action.ambiguousTime?{...action.ambiguousTime,period:null}:action.start?{hour:new Date(action.start).getHours(),minute:new Date(action.start).getMinutes(),period:new Date(action.start).getHours()>=12?'pm':'am'}:null);
  const period=parseVoicePeriod(input) || (/\b(?:afternoon|evening)\b/i.test(input)?'pm':/\bmorning\b/i.test(input)?'am':null);
  if(parsed && (parsed.start.isCertain('day') || parsed.start.isCertain('weekday')))date=localInput(parsed.start.date()).slice(0,10);
  if(parsed?.start.isCertain('hour') && !(time && period && !/\d|noon|midnight/i.test(input)))time={hour:parsed.start.get('hour'),minute:parsed.start.get('minute')||0,period:parsed.start.isCertain('meridiem')?(parsed.start.get('hour')>=12?'pm':'am'):null};
  const compact=String(input).trim().match(/^(?:at\s+)?(\d{3,4})\s*(am|pm)?[.!?]?$/i);
  if(compact){const hour=Number(compact[1].slice(0,-2)),minute=Number(compact[1].slice(-2));if(hour>=1&&hour<=23&&minute<60)time={hour,minute,period:compact[2]?.toLowerCase()||null};}
  if(!parsed && !compact && !period)return null;
  if(time && period)time={...time,period};
  return scheduleVoiceEvent(action,date,time,parsed?.end?.date());
}

export function voiceEventQuestion(action) {
  if(!action.eventDate && !action.ambiguousTime?.date && !action.start)return `What day is ${action.name}?${action.pendingTime ? ` I heard ${action.pendingTime.hour}:${String(action.pendingTime.minute).padStart(2,'0')}.` : ''}`;
  if(action.ambiguousTime)return `Is ${action.ambiguousTime.hour}:${String(action.ambiguousTime.minute).padStart(2,'0')} AM or PM?`;
  if(!action.start)return `What time is ${action.name}?`;
  return '';
}
