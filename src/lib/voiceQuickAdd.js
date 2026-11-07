import * as chrono from 'chrono-node';
const localInput = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const normalize = input => String(input || '').trim().replace(/[.!?]+$/, '').trim().replace(/^(?:(?:hey\s+famos|famos)[,\s]+)?(?:(?:can|could|would) you\s+|(?:i'd|i would) like you to\s+)?(?:please\s+)?/i, '').replace(/\s+please$/i, '').trim();
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
    if(parsed) title=title.replace(parsed.text,'');
    title=title.replace(/\b(?:as\s+an?\s+event|to\s+(?:my|the|our)\s+calendar|on\s+(?:my|the|our)\s+calendar|on\s+(?:my|the|our)\s+family\s+calendar|event\s+(?:called|named))\b/ig,'').replace(/\b(?:every|each|on|at|for)\s*$/i,'').trim();
    if(!title) return null;
    let recurrence='none'; if(/\b(?:every|each)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b/i.test(text))recurrence='weekly';else if(/\b(?:every|each)\s+day\b|\bdaily\b/i.test(text))recurrence='daily';else if(/\b(?:every|each)\s+month\b|\bmonthly\b/i.test(text))recurrence='monthly';else if(/\b(?:every|each)\s+year\b|\byearly\b/i.test(text))recurrence='yearly';else if(/\b(?:every|each)\b/i.test(text))return null;
    const hasDate=parsed && (parsed.start.isCertain('day') || parsed.start.isCertain('weekday')); const hasTime=parsed?.start.isCertain('hour');
    const start=hasDate&&hasTime?localInput(parsed.start.date()):''; const end=start?localInput(parsed.end?.date() || new Date(parsed.start.date().getTime()+60*60*1000)):'';
    return {type:'event',name:title.slice(0,120),start,end,recurrence,assumedDuration: Boolean(start&&!parsed.end)};
  }
  return null;
}
export function parseVoiceConfirmation(input) { const text=String(input||'').trim().toLowerCase().replace(/[.!?,]+/g,'').trim(); if(/^(yes|yeah|yep|confirm|yes please|go ahead|do it)$/.test(text))return 'yes';if(/^(no|nope|cancel|not now|don't|do not)$/.test(text))return 'no';return null; }
