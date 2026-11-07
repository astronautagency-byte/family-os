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
    // Speech recognition often writes 3:30 as “330”. Only treat a compact
    // number immediately following a recognized date as a time, not a title number.
    const compact=parsed && !parsed.start.isCertain('hour') ? text.slice(parsed.index+parsed.text.length).match(/^\s+(?:at\s+)?(\d{3,4})(?=\s|$)/i) : null;
    const digits=compact?.[1] || ''; const compactHour=digits ? Number(digits.slice(0,-2)) : 0; const compactMinute=digits ? Number(digits.slice(-2)) : 0;
    const validCompact=Boolean(compact && compactHour>=1 && compactHour<=23 && compactMinute<60);
    let title=text.replace(/^(?:add|create|schedule|put)\s+(?:an?\s+)?/i,'');
    if(parsed) title=title.replace(parsed.text,'');
    if(validCompact) title=title.replace(new RegExp(`^(.+?)\\s+(?:at\\s+)?${digits}(?=\\s|$)`,'i'),'$1 ');
    title=title.replace(/^event(?:\s+(?:for|called|named))?\s+/i,'');
    title=title.replace(/\b(?:as\s+an?\s+event|to\s+(?:my|the|our)\s+calendar|on\s+(?:my|the|our)\s+calendar|on\s+(?:my|the|our)\s+family\s+calendar|event\s+(?:called|named))\b/ig,'').replace(/\b(?:every|each|on|at|for)\s*$/i,'').trim();
    if(!title) return null;
    let recurrence='none'; if(/\b(?:every|each)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b/i.test(text))recurrence='weekly';else if(/\b(?:every|each)\s+day\b|\bdaily\b/i.test(text))recurrence='daily';else if(/\b(?:every|each)\s+month\b|\bmonthly\b/i.test(text))recurrence='monthly';else if(/\b(?:every|each)\s+year\b|\byearly\b/i.test(text))recurrence='yearly';else if(/\b(?:every|each)\b/i.test(text))return null;
    const hasDate=parsed && (parsed.start.isCertain('day') || parsed.start.isCertain('weekday')); const hasTime=parsed?.start.isCertain('hour');
    const hour=validCompact?compactHour:(hasTime?parsed.start.get('hour'):null);
    const minute=validCompact?compactMinute:(hasTime?parsed.start.get('minute')||0:0);
    const needsPeriod=Boolean(hasDate && hour!==null && hour>=1 && hour<=12 && (validCompact || !parsed.start.isCertain('meridiem')));
    let start=''; let end='';
    if(hasDate && hour!==null && !needsPeriod){const date=parsed.start.date();date.setHours(hour,minute,0,0);start=localInput(date);end=localInput(parsed.end?.date() || new Date(date.getTime()+60*60*1000));}
    const ambiguousTime=needsPeriod?{date:localInput(parsed.start.date()).slice(0,10),hour:hour===12?12:hour,minute}:null;
    return {type:'event',name:capitalizeFirstWord(title.replace(/\s+/g,' ').trim().slice(0,120)),start,end,recurrence,assumedDuration:Boolean(start&&!parsed.end),...(ambiguousTime?{ambiguousTime}:{})};
  }
  return null;
}
export function parseVoiceConfirmation(input) { const text=String(input||'').trim().toLowerCase().replace(/[.!?,]+/g,'').trim(); if(/^(yes|yeah|yep|confirm|yes please|go ahead|do it)$/.test(text))return 'yes';if(/^(no|nope|cancel|not now|don't|do not)$/.test(text))return 'no';return null; }

/** Resolve an explicitly ambiguous 12-hour time only after the user chooses AM or PM. */
export function resolveVoicePeriod(action, period) {
  const t=action?.ambiguousTime;if(!t || !['am','pm'].includes(period))return action;
  const hour=(t.hour%12)+(period==='pm'?12:0);const date=new Date(`${t.date}T${String(hour).padStart(2,'0')}:${String(t.minute).padStart(2,'0')}:00`);
  if(!Number.isFinite(date.getTime()) || date.getHours()!==hour || date.getMinutes()!==t.minute)return action;
  return {...action,start:localInput(date),end:localInput(new Date(date.getTime()+60*60*1000)),assumedDuration:true,ambiguousTime:null};
}

export function parseVoicePeriod(input) { const text=String(input||'').toLowerCase().replace(/[.\s]/g,'');if(['am','morning','inthemorning'].includes(text))return 'am';if(['pm','afternoon','evening','intheafternoon','intheevening'].includes(text))return 'pm';return null; }
