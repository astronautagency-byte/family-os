import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from './icons';
import { Modal, PrimaryButton, SecondaryButton, TextField } from './ui';
import { useFamily } from '../context/FamilyContext';
import { parseVoiceQuickAdd, parseVoiceConfirmation, capitalizeFirstWord, resolveVoicePeriod, parseVoicePeriod } from '../lib/voiceQuickAdd';
import { invokeEdgeFunction } from '../lib/supabase';
import './voice-quick-add.css';

export default function VoiceQuickAdd({ features = {}, hidden = false }) {
  const { addGrocery, addTask, addEvent, addGoogleCalendarEvent, addGroceryList, addTaskList, setMealForSlot, groceryLists = [], taskLists = [], meals = [], googleConnected = false, googleCalendars = [], selectedGoogleCalendarIds = [], googleCalendarAliases = {}, famosCalendar } = useFamily();
  const [open, setOpen] = useState(false), [listening, setListening] = useState(false), [transcript, setTranscript] = useState('');
  const [action, setAction] = useState(null), [message, setMessage] = useState('What can I help you add?'), [error, setError] = useState(''), [busy, setBusy] = useState(false), [typing, setTyping] = useState(false);
  const recognition = useRef(null), timeout = useRef(null), current = useRef(0), saving = useRef(false), active = useRef(true);
  const conversation = useRef([]), originalRequest = useRef(''), requestId = useRef(0);
  const [followup, setFollowup] = useState(''), [thinking, setThinking] = useState(false);
  const stop = () => { current.current++; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; const rec = recognition.current; recognition.current = null; try { rec?.abort(); } catch {} setListening(false); };
  const silence = () => { try { window.speechSynthesis?.cancel(); } catch {} };
  const say = (words) => { setMessage(words); try { if (window.speechSynthesis && window.SpeechSynthesisUtterance) { silence(); window.speechSynthesis.speak(new window.SpeechSynthesisUtterance(words)); } } catch {} };
  useEffect(() => { active.current = true; const pause = () => { if (document.hidden) { stop(); silence(); } }; document.addEventListener('visibilitychange', pause); return () => { active.current = false; document.removeEventListener('visibilitychange', pause); current.current++; if (timeout.current) clearTimeout(timeout.current); try { recognition.current?.abort(); } catch {} silence(); }; }, []);
  useEffect(() => { if (hidden && open) { requestId.current++; conversation.current = []; originalRequest.current = ''; setThinking(false); stop(); silence(); setOpen(false); } }, [hidden]);
  const close = () => { if (busy) return; requestId.current++; conversation.current = []; originalRequest.current = ''; setFollowup(''); setThinking(false); stop(); silence(); setOpen(false); setError(''); setTranscript(''); setAction(null); setTyping(false); setMessage('What can I help you add?'); };
  const featureFor = type => ({ grocery: 'groceries', groceryList: 'groceries', task: 'tasks', taskList: 'tasks', event: 'calendar', meal: 'meals' })[type];
  const review = (heard) => { let result = parseVoiceQuickAdd(heard, { groceryLists, taskLists }); if (result?.type === 'event') result = { ...result, destination: 'family' }; setError(''); if (!result) { setAction(null); askAI(heard); return; } setAction(result); originalRequest.current = heard; if (features[featureFor(result.type)] === false) { setError('This feature is turned off for your household.'); return; } say(result.type === 'event' && !result.start && !result.ambiguousTime ? `What date and time should I add ${result.name}?` : result.type === 'meal' && !result.date ? `What date should I plan ${result.name} for ${result.slot}?` : result.type === 'event' ? `Should I add ${result.name} to the family calendar${result.start ? ` starting ${new Date(result.start).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}${result.recurrence !== 'none' ? `, repeating ${result.recurrence}` : ''}? ${result.ambiguousTime ? `I heard ${result.ambiguousTime.hour}:${String(result.ambiguousTime.minute).padStart(2,'0')}. Please choose AM or PM.` : result.assumedDuration ? 'I suggested one hour. Please check the end time.' : 'Please review the date and time.'}` : result.type === 'meal' ? `Should I plan ${result.name} for ${result.slot}? Please review the date${meals.some(m=>m.date===result.date && m.slot===result.slot && m.title) ? ' and note that this will replace the existing meal' : ''}.` : result.type === 'grocery' ? `Should I add ${result.name} to ${result.listName || 'your shopping list'}?` : result.type === 'task' ? `Should I add the task ${result.name}${result.listName ? ` to ${result.listName}` : ''}?` : `Should I create the list ${result.name}?`); };
  // The assistant may ask questions, but only the reviewed client action can save.
  const askAI = async (heard) => {
    if (!heard.trim()) return;
    const id = ++requestId.current;
    const turns = [...conversation.current, { role: 'user', content: heard.trim() }].slice(-8);
    conversation.current = turns;
    setThinking(true); setError('');
    try {
      const response = await invokeEdgeFunction('fam-ai', { messages: turns, context: { screen: 'voice', localDate: new Date().toLocaleDateString('en-CA'), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      if (!active.current || id !== requestId.current) return;
      const proposed = Array.isArray(response?.actions) ? response.actions : [];
      // AI output is never executed directly. Restrict conversion to explicit,
      // single-item additions; dates, lists, and other actions require the
      // existing parser/review flow instead of guessing.
      const first = proposed.length === 1 ? proposed[0] : null;
      const args = first?.args || {};
      const userText = turns.filter(t => t.role === 'user').map(t => t.content).join(' ');
      const explicit = /\b(add|put|create|make)\b/i.test(userText) && !/\b(delete|remove|buy|purchase|send)\b/i.test(userText);
      const name = String(first?.type === 'add_grocery' ? args.name || '' : args.title || '').trim();
      const exactName = name && name.length <= 120 && userText.toLocaleLowerCase().includes(name.toLocaleLowerCase());
      const defaultGrocery = /\b(?:grocery|shopping) list\b/i.test(userText) && !args.unit && (args.quantity == null || args.quantity === 1) && !/\b(?:two|three|four|five|half|dozen|\d+)\b/i.test(userText);
      const defaultTask = /\btask\b/i.test(userText) && !args.assignee_name && !args.due_date && !args.task_type;
      const candidate = explicit && exactName && first?.type === 'add_grocery' && defaultGrocery ? { type: 'grocery', name } : explicit && exactName && first?.type === 'add_task' && defaultTask ? { type: 'task', name } : null;
      if (candidate?.name && features[featureFor(candidate.type)] !== false && !response?.missing_fields?.length) {
        setAction(candidate);
        const prompt = candidate.type === 'grocery' ? `Should I add ${candidate.name} to your shopping list?` : `Should I add the task ${candidate.name}?`;
        conversation.current = [...turns, { role: 'assistant', content: prompt }]; say(prompt);
      } else {
        const prompt = proposed.length ? 'I can help with that, but I need a clearer request before preparing it. What would you like to add, and where?' : (typeof response?.message === 'string' && response.message.trim() ? response.message.trim().slice(0, 600) : 'Could you tell me a little more?');
        conversation.current = [...turns, { role: 'assistant', content: prompt }]; say(prompt);
      }
    } catch {
      if (active.current && id === requestId.current) say('I couldn’t reach Fam AI. You can try again, or use a direct request like “add lemons to my shopping list.”');
    } finally { if (active.current && id === requestId.current) setThinking(false); }
  };
  const continueConversation = (heard) => {
    if (!heard.trim()) return;
    setFollowup(''); setTranscript(heard);
    if (action && ((action.type === 'event' && !action.start && !action.ambiguousTime) || (action.type === 'meal' && !action.date))) {
      const combined = `${originalRequest.current} ${heard}`;
      const resolved = parseVoiceQuickAdd(combined, { groceryLists, taskLists });
      if (resolved && ((resolved.type === 'event' && (resolved.start || resolved.ambiguousTime)) || (resolved.type === 'meal' && resolved.date))) { review(combined); return; }
      say('I still need the date and time. Please say them together, or enter them below.'); return;
    }
    if (action) { say('Please use the review fields to change the details, or confirm when they are correct.'); return; }
    askAI(heard);
  };
  const save = async (item = action) => {
    if (saving.current) return;
    if (item?.type === 'event' && item.destination !== 'family' && item.recurrence !== 'none') { setError('Repeating events currently need the FamOS family calendar. Choose that calendar or turn off repeat.'); return; }
    if (item?.type === 'event' && item.destination !== 'family' && (!googleConnected || !googleCalendars.some(c => c.id === item.destination && selectedGoogleCalendarIds.includes(c.id) && ['owner','writer'].includes(c.accessRole)))) { setError('That calendar is no longer available for editing. Choose another calendar.'); return; }
    if (!item?.name?.trim() || features[featureFor(item.type)] === false || (item.type === 'event' && (!item.start || !item.end || new Date(item.end) <= new Date(item.start))) || (item.type === 'meal' && !item.date)) { say('Please review and complete the details before adding.'); return; }
    saving.current = true; setBusy(true); setError('');
    try { if (item.type === 'grocery') await addGrocery({ name: item.name.trim(), quantity: 1, unit: '', ...(item.listId ? { listId: item.listId } : {}) }); else if (item.type === 'task') await addTask({ title: item.name.trim(), assigneeIds: [], ...(item.listId ? { listId: item.listId } : {}) }); else if (item.type === 'event') { const event = {title:capitalizeFirstWord(item.name),start:new Date(item.start).toISOString(),end:new Date(item.end).toISOString(),recurrence:item.recurrence,location:'',memberIds:[]}; if(item.destination === 'family') await addEvent(event); else await addGoogleCalendarEvent({...event,calendarId:item.destination}); } else if(item.type === 'meal') await setMealForSlot(item.date,item.slot,{title:item.name.trim(),notes:'',cookIds:[]}); else if(item.type === 'groceryList') await addGroceryList({name:item.name.trim()}); else if(item.type === 'taskList') await addTaskList({name:item.name.trim()}); else throw new Error('Unsupported action');
      if (active.current) { setAction(null); setTranscript(''); say(item.type === 'grocery' ? `Done. I added ${item.name} to ${item.listName || 'your shopping list'}.` : item.type === 'task' ? `Done. I added ${item.name} to your tasks.` : item.type === 'event' ? `Done. I added ${capitalizeFirstWord(item.name)} to ${item.destination === 'family' ? (famosCalendar?.name || 'your family calendar') : (googleCalendarAliases[item.destination] || googleCalendars.find(c => c.id === item.destination)?.summary || 'your Google calendar')}.` : item.type === 'meal' ? `Done. I planned ${item.name} for ${item.slot}.` : `Done. I created the list ${item.name}.`); }
    } catch { if (active.current) setError('I couldn’t save that. Your request is still here; please try again.'); } finally { saving.current = false; if (active.current) setBusy(false); }
  };
  const start = (mode = 'request') => {
    stop(); silence(); setError('');
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { setError('Voice recognition isn’t available on this device. You can type instead.'); setTyping(true); return; }
    const id = ++current.current;
    try { const rec = new Ctor(); recognition.current = rec; rec.lang = navigator.language || 'en-US'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (event) => { if (id !== current.current) return; const heard = event.results?.[0]?.[0]?.transcript?.trim() || ''; stop(); if (mode === 'period') { const period=parseVoicePeriod(heard); if (!period) { say('Please say AM or PM, or choose a button.'); return; } const resolved=resolveVoicePeriod(action,period); if(resolved?.ambiguousTime){setError('Please choose a valid date and time.');return;} setAction(resolved); say(`Got it, ${period.toUpperCase()}. Please review the event details before adding.`); } else if (mode === 'followup') { continueConversation(heard); } else if (mode === 'confirm') { const answer = parseVoiceConfirmation(heard); if (answer === 'yes') save(action); else if (answer === 'no') { setAction(null); say('Okay, I won’t add it.'); } else say('Please say yes or no, or use the buttons below.'); } else { setTranscript(heard); review(heard); } };
      rec.onerror = (event) => { if (id !== current.current) return; stop(); setError(event.error === 'not-allowed' ? 'Microphone permission was denied. You can type instead.' : event.error === 'no-speech' ? 'I didn’t hear anything. Try again or type instead.' : 'Voice recognition stopped. Try again or type instead.'); };
      rec.onend = () => { if (id !== current.current) return; if (timeout.current) clearTimeout(timeout.current); timeout.current = null; recognition.current = null; setListening(false); };
      rec.start(); setListening(true); timeout.current = setTimeout(() => { if (id === current.current) { stop(); setError('Listening timed out. Try again or type instead.'); } }, 15000);
    } catch { stop(); setError('Could not start the microphone. You can type instead.'); setTyping(true); }
  };
  if (hidden) return null;
  return <><button className="voice-quick-fab" type="button" onClick={() => setOpen(true)} aria-label="Voice quick add"><Mic size={21}/><span>Voice</span></button>
    <Modal open={open} onClose={close} title="Talk to FamOS" className="voice-quick-modal"><div className="voice-quick-content">
      <div className="voice-quick-conversation" aria-live="polite"><span className="voice-quick-orb"><Mic size={28}/></span><p className="voice-quick-prompt">{listening ? 'I’m listening…' : message}</p>{transcript && <p className="voice-quick-heard">You: “{transcript}”</p>}</div>
      {action ? <div className="voice-quick-review"><TextField label={action.type === 'grocery' ? 'Shopping item' : action.type === 'task' ? 'Task' : action.type === 'event' ? 'Event' : action.type === 'meal' ? 'Meal' : 'List name'} value={action.name} onChange={e => setAction({ ...action, name: e.target.value })} maxLength={120}/>{action.listName && <p>Adding to: {action.listName}</p>}{action.type === 'event' && <>{action.ambiguousTime ? <div className="voice-quick-ambiguous"><label>Event date<input aria-label="Event date" type="date" value={action.ambiguousTime.date} onChange={e=>setAction({...action,ambiguousTime:{...action.ambiguousTime,date:e.target.value}})}/></label><fieldset><legend>Is {action.ambiguousTime.hour}:{String(action.ambiguousTime.minute).padStart(2,'0')} AM or PM?</legend><div className="voice-period-options"><button type="button" onClick={()=>setAction(resolveVoicePeriod(action,'am'))}>AM</button><button type="button" onClick={()=>setAction(resolveVoicePeriod(action,'pm'))}>PM</button></div><button type="button" className="voice-period-speak" onClick={()=>listening ? stop() : start('period')}>{listening ? 'Stop listening' : 'Say AM or PM'}</button></fieldset></div> : <><label>Start<input aria-label="Start" type="datetime-local" value={action.start} onChange={e=>setAction({...action,start:e.target.value})}/></label><label>End<input aria-label="End" type="datetime-local" value={action.end} onChange={e=>setAction({...action,end:e.target.value,assumedDuration:false})}/></label></>}<label>Repeat<select aria-label="Repeat" value={action.recurrence} onChange={e=>setAction({...action,recurrence:e.target.value})}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="yearly">Every year</option></select></label>{action.assumedDuration && <p>One hour suggested; please check the end time.</p>}<label>Calendar<select aria-label="Calendar" value={action.destination} onChange={e=>setAction({...action,destination:e.target.value})}><option value="family">{famosCalendar?.name || 'FamOS family calendar'}</option>{googleConnected && googleCalendars.filter(c=>selectedGoogleCalendarIds.includes(c.id) && ['owner','writer'].includes(c.accessRole)).map(c=><option key={c.id} value={c.id}>{googleCalendarAliases[c.id] || c.summary || 'Google Calendar'}</option>)}</select></label>{action.destination !== 'family' && action.recurrence !== 'none' && <p role="alert">Repeating events currently need the FamOS family calendar. Choose that calendar or turn off repeat.</p>}</>}{action.type === 'meal' && <><label>Meal date<input aria-label="Meal date" type="date" value={action.date} onChange={e=>setAction({...action,date:e.target.value})}/></label><label>Meal<select aria-label="Meal" value={action.slot} onChange={e=>setAction({...action,slot:e.target.value})}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></label>{meals.some(m=>m.date===action.date && m.slot===action.slot && m.title) && <p>This will replace the meal already planned for this slot.</p>}</>}{features[featureFor(action.type)] !== false && <><PrimaryButton disabled={busy || !action.name.trim() || (action.type === 'event' && (!action.start || !action.end || new Date(action.end) <= new Date(action.start))) || (action.type === 'meal' && !action.date) || (action.type === 'event' && action.destination !== 'family' && action.recurrence !== 'none')} onClick={() => save()}>{busy ? 'Adding…' : 'Yes, add it'}</PrimaryButton><SecondaryButton disabled={busy} onClick={() => listening ? stop() : start('confirm')}>{listening ? 'Stop listening' : 'Say yes or no'}</SecondaryButton></>}<SecondaryButton disabled={busy} onClick={() => { stop(); setAction(null); say('Okay, I won’t add it.'); }}>Cancel</SecondaryButton></div> : <button type="button" className={`voice-quick-listen ${listening ? 'is-listening' : ''}`} onClick={listening ? stop : () => start('request')} aria-pressed={listening}>{listening ? <><MicOff size={18}/> Stop listening</> : <><Mic size={18}/> Tap to speak</>}</button>}
      {thinking && <p role="status">Thinking…</p>}
      {action && !action.ambiguousTime && ((action.type === 'event' && !action.start) || (action.type === 'meal' && !action.date)) && <button type="button" className="voice-quick-type" disabled={thinking} onClick={() => listening ? stop() : start('followup')}>{listening ? 'Stop listening' : 'Say the missing details'}</button>}
      {!action && conversation.current.length > 0 && <button type="button" className="voice-quick-type" disabled={thinking} onClick={() => listening ? stop() : start('followup')}>{listening ? 'Stop listening' : 'Reply by voice'}</button>}
      {error && <p role="alert" className="voice-quick-error">{error}</p>}
      {action && !action.ambiguousTime && ((action.type === 'event' && !action.start) || (action.type === 'meal' && !action.date)) && <><TextField label="Your reply" value={followup} onChange={e => setFollowup(e.target.value)} placeholder="e.g. tomorrow at 3 PM"/><SecondaryButton disabled={!followup.trim() || thinking} onClick={() => continueConversation(followup)}>Send reply</SecondaryButton></>}
      {!action && <><button type="button" className="voice-quick-type" onClick={() => setTyping(!typing)}>{typing ? 'Hide typing' : 'Type instead'}</button>{typing && <><TextField label="Your request" value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Can you add lemons to my grocery list?"/><SecondaryButton disabled={listening || !transcript.trim()} onClick={() => conversation.current.length ? continueConversation(transcript) : review(transcript)}>Review request</SecondaryButton></>}</>}
      <p className="voice-quick-privacy">Your browser or device may send audio to its speech provider. When needed, your transcript is sent to Fam AI for a response. FamOS doesn’t save audio. The microphone is on only while listening.</p>
    </div></Modal></>;
}
